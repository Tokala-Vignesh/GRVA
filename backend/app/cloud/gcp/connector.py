import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from google.oauth2 import service_account
from google.auth import default as google_default_auth
from google.cloud import compute_v1
from google.cloud import monitoring_v3
from google.cloud import logging_v2
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample, MetricNormalizer

logger = logging.getLogger("cloudsentinel.cloud.gcp")

class GCPConnector(BaseCloudConnector):
    """
    Google Cloud Platform Connector using official google-cloud Python SDKs.
    Interacts with Compute Engine, Cloud Monitoring, Cloud Logging, and Cloud Billing.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.project_id = self.credentials.get("project_id", "")
        self.region = self.credentials.get("region", "us-central1")
        self._gcp_credentials = self._resolve_credentials()

    def _resolve_credentials(self):
        """Parse Service Account JSON or utilize Application Default Credentials."""
        sa_json_str = self.credentials.get("service_account_json")
        sa_file_path = self.credentials.get("service_account_file")

        if sa_json_str:
            info = json.loads(sa_json_str) if isinstance(sa_json_str, str) else sa_json_str
            if not self.project_id and "project_id" in info:
                self.project_id = info["project_id"]
            return service_account.Credentials.from_service_account_info(info)

        if sa_file_path:
            creds = service_account.Credentials.from_service_account_file(sa_file_path)
            return creds

        # Fall back to ADC
        creds, detected_proj = google_default_auth()
        if not self.project_id and detected_proj:
            self.project_id = detected_proj
        return creds

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate GCP credentials by querying Zones in Compute Engine.
        """
        try:
            zones_client = compute_v1.ZonesClient(credentials=self._gcp_credentials)
            request = compute_v1.ListZonesRequest(project=self.project_id, max_results=1)
            page = zones_client.list(request=request)
            for _ in page:
                break
            logger.info(f"GCP Credentials validated for Project {self.project_id}")
            return {
                "valid": True,
                "project_id": self.project_id,
                "region": self.region,
            }
        except Exception as e:
            logger.error(f"GCP credential validation failed: {e}")
            raise ValueError(f"GCP Authentication failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Compute Engine instances across all zones using AggregatedList.
        """
        instances_client = compute_v1.InstancesClient(credentials=self._gcp_credentials)
        discovered: List[DiscoveredResource] = []

        try:
            request = compute_v1.AggregatedListInstancesRequest(
                project=self.project_id,
                max_results=500,
            )
            agg_list = instances_client.aggregated_list(request=request)

            for zone_key, scoped_list in agg_list:
                if scoped_list.instances:
                    # zone_key looks like "zones/us-central1-a"
                    clean_zone = zone_key.split("/")[-1]
                    # derive region from zone e.g. "us-central1"
                    clean_region = "-".join(clean_zone.split("-")[:-1]) if "-" in clean_zone else self.region

                    for inst in scoped_list.instances:
                        instance_id = str(inst.id)
                        name = inst.name
                        machine_type = inst.machine_type.split("/")[-1] if inst.machine_type else "unknown"
                        status_str = inst.status.lower() if inst.status else "unknown"

                        # Network interfaces
                        internal_ip = None
                        external_ip = None
                        for nic in inst.network_interfaces:
                            if nic.network_i_p:
                                internal_ip = nic.network_i_p
                            for access_config in nic.access_configs:
                                if access_config.nat_i_p:
                                    external_ip = access_config.nat_i_p

                        # Attached disks
                        attached_disks = [d.source.split("/")[-1] for d in inst.disks if d.source]

                        discovered.append(DiscoveredResource(
                            resource_id=instance_id,
                            resource_name=name,
                            provider="gcp",
                            resource_type="virtual_machine",
                            region=clean_region,
                            zone=clean_zone,
                            status=status_str,
                            ip_address=external_ip,
                            private_ip=internal_ip,
                            instance_type=machine_type,
                            tags=dict(inst.labels) if inst.labels else {},
                            raw_metadata={
                                "self_link": inst.self_link,
                                "cpu_platform": inst.cpu_platform,
                                "disks": attached_disks,
                                "creation_timestamp": inst.creation_timestamp,
                            }
                        ))

            logger.info(f"Discovered {len(discovered)} GCP Compute Engine instances in {self.project_id}")
            return discovered
        except Exception as e:
            logger.error(f"GCP instance discovery error: {e}")
            raise RuntimeError(f"GCP Compute Engine discovery failed: {str(e)}")

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Query Cloud Monitoring MetricService for CPU, network, and disk metrics.
        """
        client = monitoring_v3.MetricServiceClient(credentials=self._gcp_credentials)
        project_name = f"projects/{self.project_id}"
        instance_id = resource.resource_id

        # Time interval
        interval = monitoring_v3.TimeInterval(
            start_time={"seconds": int(start_time.timestamp())},
            end_time={"seconds": int(end_time.timestamp())},
        )

        # Map of desired metrics to queries
        metric_filters = {
            "cpu_utilization": f'metric.type = "compute.googleapis.com/instance/cpu/utilization" AND metric.labels.instance_name = "{resource.resource_name}"',
            "network_in_bytes": f'metric.type = "compute.googleapis.com/instance/network/received_bytes_count" AND metric.labels.instance_name = "{resource.resource_name}"',
            "network_out_bytes": f'metric.type = "compute.googleapis.com/instance/network/sent_bytes_count" AND metric.labels.instance_name = "{resource.resource_name}"',
            "disk_read_bytes": f'metric.type = "compute.googleapis.com/instance/disk/read_bytes_count" AND metric.labels.instance_name = "{resource.resource_name}"',
            "disk_write_bytes": f'metric.type = "compute.googleapis.com/instance/disk/write_bytes_count" AND metric.labels.instance_name = "{resource.resource_name}"',
        }

        time_map: Dict[datetime, Dict[str, float]] = {}

        for m_key, m_filter in metric_filters.items():
            try:
                aggregation = monitoring_v3.Aggregation(
                    alignment_period={"seconds": period_seconds},
                    per_series_aligner=monitoring_v3.Aggregation.Aligner.ALIGN_MEAN,
                )
                request = monitoring_v3.ListTimeSeriesRequest(
                    name=project_name,
                    filter=m_filter,
                    interval=interval,
                    view=monitoring_v3.ListTimeSeriesRequest.TimeSeriesView.FULL,
                    aggregation=aggregation,
                )
                results = client.list_time_series(request=request)
                for series in results:
                    for pt in series.points:
                        pt_ts = datetime.fromtimestamp(pt.interval.end_time.timestamp(), tz=timezone.utc)
                        # Extract value (double or int64)
                        val = pt.value.double_value if pt.value.double_value else float(pt.value.int64_value)
                        if pt_ts not in time_map:
                            time_map[pt_ts] = {}
                        time_map[pt_ts][m_key] = val
            except Exception as e:
                logger.debug(f"Failed to query GCP metric {m_key} for {resource.resource_name}: {e}")

        samples: List[UnifiedMetricSample] = []
        for ts, metrics_dict in sorted(time_map.items()):
            sample = MetricNormalizer.normalize_gcp(
                resource_id=instance_id,
                resource_name=resource.resource_name,
                region=resource.region,
                status=resource.status,
                timestamp=ts,
                monitoring_metrics=metrics_dict,
                ops_agent_installed=False, # Ops agent needed for mem/disk%
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
        Query Cloud Logging API for instance logs.
        """
        logs_client = logging_v2.Client(credentials=self._gcp_credentials, project=self.project_id)
        events: List[Dict[str, Any]] = []

        try:
            start_iso = start_time.isoformat()
            end_iso = end_time.isoformat()
            log_filter = (
                f'resource.type="gce_instance" '
                f'resource.labels.instance_id="{resource_id}" '
                f'timestamp >= "{start_iso}" '
                f'timestamp <= "{end_iso}"'
            )
            entries = logs_client.list_entries(filter_=log_filter, max_results=limit)
            for entry in entries:
                events.append({
                    "timestamp": entry.timestamp.isoformat() if entry.timestamp else "",
                    "severity": str(entry.severity),
                    "message": str(entry.payload),
                    "insert_id": entry.insert_id,
                })
        except Exception as e:
            logger.warning(f"Could not retrieve GCP Cloud Logging entries for {resource_id}: {e}")

        return events

    def collect_costs(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        Query Google Cloud Billing export dataset if BigQuery configured or return documented placeholder.
        """
        # Google Cloud Billing requires BigQuery export configuration.
        logger.info(f"GCP Billing export check for project {self.project_id}")
        return []
