import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
try:
    from azure.mgmt.resource.resources import ResourceManagementClient
except ImportError:
    from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.monitor import MonitorManagementClient
from azure.core.exceptions import HttpResponseError
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample, MetricNormalizer

logger = logging.getLogger("cloudsentinel.cloud.azure")

class AzureConnector(BaseCloudConnector):
    """
    Microsoft Azure Cloud Connector using official Azure SDKs.
    Interacts with Azure Compute Management, Resource Management, and Azure Monitor.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.subscription_id = self.credentials.get("subscription_id", "")
        self.tenant_id = self.credentials.get("tenant_id", "")
        self.client_id = self.credentials.get("client_id", "")
        self.client_secret = self.credentials.get("client_secret", "")
        self.region = self.credentials.get("region", "eastus")
        
        self._credential = self._create_credential()
        self._compute_client = ComputeManagementClient(self._credential, self.subscription_id)
        self._resource_client = ResourceManagementClient(self._credential, self.subscription_id)
        self._monitor_client = MonitorManagementClient(self._credential, self.subscription_id)

    def _create_credential(self) -> ClientSecretCredential:
        return ClientSecretCredential(
            tenant_id=self.tenant_id,
            client_id=self.client_id,
            client_secret=self.client_secret,
        )

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate credentials by issuing a list request against resource groups.
        """
        try:
            rg_iter = self._resource_client.resource_groups.list(top=1)
            for _ in rg_iter:
                break
            logger.info(f"Azure credentials validated for Subscription {self.subscription_id}")
            return {
                "valid": True,
                "subscription_id": self.subscription_id,
                "tenant_id": self.tenant_id,
                "region": self.region,
            }
        except Exception as e:
            logger.error(f"Azure credential validation error: {e}")
            raise ValueError(f"Azure Authentication failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Virtual Machines across the subscription.
        """
        discovered: List[DiscoveredResource] = []

        try:
            vms = self._compute_client.virtual_machines.list_all()
            for vm in vms:
                vm_id = vm.id
                name = vm.name
                location = vm.location
                vm_size = vm.hardware_profile.vm_size if vm.hardware_profile else "unknown"

                rg_name = "unknown"
                parts = vm_id.split("/")
                for i, p in enumerate(parts):
                    if p.lower() == "resourcegroups" and i + 1 < len(parts):
                        rg_name = parts[i + 1]
                        break

                status_str = "unknown"
                try:
                    iv = self._compute_client.virtual_machines.instance_view(rg_name, name)
                    for st in iv.statuses or []:
                        code = st.code or ""
                        if code.startswith("PowerState/"):
                            status_str = code.split("/")[-1].lower()
                except Exception as e:
                    logger.debug(f"Could not retrieve instance view for {name}: {e}")

                nics_info = []
                if vm.network_profile and vm.network_profile.network_interfaces:
                    for nic_ref in vm.network_profile.network_interfaces:
                        nics_info.append(nic_ref.id)

                discovered.append(DiscoveredResource(
                    resource_id=vm_id,
                    resource_name=name,
                    provider="azure",
                    resource_type="virtual_machine",
                    region=location,
                    zone=location,
                    status=status_str,
                    ip_address=None,
                    private_ip=None,
                    instance_type=vm_size,
                    tags=dict(vm.tags) if vm.tags else {},
                    raw_metadata={
                        "resource_group": rg_name,
                        "os_type": vm.storage_profile.os_disk.os_type if (vm.storage_profile and vm.storage_profile.os_disk) else None,
                        "network_interfaces": nics_info,
                    }
                ))

            logger.info(f"Discovered {len(discovered)} Azure Virtual Machines in subscription {self.subscription_id}")
            return discovered
        except Exception as e:
            logger.error(f"Azure VM discovery failed: {e}")
            raise RuntimeError(f"Azure VM discovery failed: {str(e)}")

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Query Azure Monitor metrics.
        """
        resource_uri = resource.resource_id
        metric_names = [
            "Percentage CPU",
            "Network In Total",
            "Network Out Total",
            "Disk Read Bytes",
            "Disk Write Bytes",
        ]

        time_map: Dict[datetime, Dict[str, float]] = {}

        try:
            timespan = f"{start_time.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end_time.strftime('%Y-%m-%dT%H:%M:%SZ')}"
            response = self._monitor_client.metrics.list(
                resource_uri=resource_uri,
                timespan=timespan,
                interval=f"PT{period_seconds}S",
                metricnames=",".join(metric_names),
                aggregation="Average",
            )

            for metric in response.value:
                m_name = metric.name.localized_value or metric.name.value
                for ts_element in metric.timeseries:
                    for data in ts_element.data:
                        if data.average is not None:
                            ts = data.time_stamp
                            if ts.tzinfo is None:
                                ts = ts.replace(tzinfo=timezone.utc)
                            if ts not in time_map:
                                time_map[ts] = {}
                            time_map[ts][m_name] = float(data.average)

        except Exception as e:
            logger.debug(f"Azure Monitor query error for {resource.resource_name}: {e}")

        samples: List[UnifiedMetricSample] = []
        for ts, metrics_dict in sorted(time_map.items()):
            sample = MetricNormalizer.normalize_azure(
                resource_id=resource.resource_id,
                resource_name=resource.resource_name,
                region=resource.region,
                status=resource.status,
                timestamp=ts,
                azure_monitor_metrics=metrics_dict,
                ama_agent_installed=False,
            )
            samples.append(sample)

        return samples

    def collect_logs(
        self,
        resource_id: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Query Azure Activity Logs for administrative events.
        """
        events: List[Dict[str, Any]] = []
        try:
            filter_str = (
                f"eventTimestamp ge '{start_time.isoformat()}' and "
                f"eventTimestamp le '{end_time.isoformat()}'"
            )
            logs_iter = self._monitor_client.activity_logs.list(filter=filter_str)
            count = 0
            for item in logs_iter:
                events.append({
                    "timestamp": item.event_timestamp.isoformat() if item.event_timestamp else "",
                    "operation_name": item.operation_name.localized_value if item.operation_name else "",
                    "status": item.status.localized_value if item.status else "",
                    "caller": item.caller,
                })
                count += 1
                if count >= limit:
                    break
        except Exception as e:
            logger.warning(f"Could not retrieve Azure Activity logs: {e}")

        return events

    def collect_costs(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        return []
