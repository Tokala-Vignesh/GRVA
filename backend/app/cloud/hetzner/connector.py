import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.hetzner")

class HetznerConnector(BaseCloudConnector):
    """
    Hetzner Cloud Connector.
    Interacts with Hetzner Cloud REST API v1 for virtual servers and free metrics.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.api_token = self.credentials.get("api_token", "")
        self.base_url = "https://api.hetzner.cloud/v1"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "CloudSentinel-Agent/1.0",
        }

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Hetzner Cloud API Token.
        """
        if not self.api_token:
            raise ValueError("Hetzner Cloud API Token is required.")

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(f"{self.base_url}/servers?per_page=1", headers=self._get_headers())
                if resp.status_code == 200:
                    meta = resp.json().get("meta", {}).get("pagination", {})
                    total_servers = meta.get("total_entries", 0)
                    logger.info(f"Hetzner Cloud token verified successfully ({total_servers} servers found)")
                    return {
                        "valid": True,
                        "account_id": f"hetzner-{self.api_token[:8]}",
                        "total_servers": total_servers,
                        "status": "connected",
                    }
                elif resp.status_code == 401:
                    raise ValueError("Hetzner Cloud authentication failed: Invalid API Token (401).")
                else:
                    raise ValueError(f"Hetzner Cloud returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Hetzner validation error: {e}")
            raise ValueError(f"Hetzner validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Hetzner Cloud servers via /v1/servers.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/servers?per_page=50", headers=self._get_headers())
                if resp.status_code == 200:
                    servers = resp.json().get("servers", [])
                    for s in servers:
                        pub_net = s.get("public_net", {})
                        ipv4 = pub_net.get("ipv4", {}).get("ip")
                        dc = s.get("datacenter", {})
                        location = dc.get("location", {}).get("name", "eu-central")
                        st = "running" if s.get("status") == "running" else "stopped"
                        server_type = s.get("server_type", {}).get("name", "cx11")

                        resources.append(DiscoveredResource(
                            resource_id=str(s.get("id")),
                            resource_name=s.get("name", "hetzner-server"),
                            provider="hetzner",
                            resource_type="virtual_machine",
                            region=location,
                            zone=dc.get("name", location),
                            status=st,
                            ip_address=ipv4,
                            instance_type=server_type,
                            tags=s.get("labels", {}),
                            raw_metadata={
                                "cores": s.get("server_type", {}).get("cores"),
                                "memory": s.get("server_type", {}).get("memory"),
                                "disk": s.get("server_type", {}).get("disk"),
                            },
                        ))
        except Exception as e:
            logger.warning(f"Hetzner server discovery error: {e}")

        return resources

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Collect CPU/Disk metrics using Hetzner Cloud metrics endpoint.
        """
        samples: List[UnifiedMetricSample] = []
        try:
            start_iso = start_time.isoformat()
            end_iso = end_time.isoformat()
            url = f"{self.base_url}/servers/{resource.resource_id}/metrics?type=cpu&start={start_iso}&end={end_iso}&step={period_seconds}"
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(url, headers=self._get_headers())
                if resp.status_code == 200:
                    metrics = resp.json().get("metrics", {})
                    ts_series = metrics.get("time_series", {}).get("cpu", {}).get("values", [])
                    for entry in ts_series[-5:]:
                        ts, val = entry[0], entry[1]
                        samples.append(UnifiedMetricSample(
                            provider="hetzner",
                            resource_id=resource.resource_id,
                            resource_name=resource.resource_name,
                            region=resource.region,
                            status=resource.status,
                            cpu_usage_percent=float(val) if val is not None else None,
                            event_timestamp=datetime.fromtimestamp(float(ts), tz=timezone.utc),
                            source="hetzner_metrics",
                        ))
        except Exception as e:
            logger.debug(f"Hetzner metric collection error: {e}")

        return samples

    def collect_logs(
        self,
        resource_id: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        return []

    def collect_costs(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        return []
