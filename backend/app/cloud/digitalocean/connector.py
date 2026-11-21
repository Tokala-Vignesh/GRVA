import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.digitalocean")

class DigitalOceanConnector(BaseCloudConnector):
    """
    DigitalOcean Cloud Connector.
    Interacts with DigitalOcean REST API v2 and Free Monitoring Metrics API.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.api_token = self.credentials.get("api_token", "")
        self.base_url = "https://api.digitalocean.com/v2"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "CloudSentinel-Agent/1.0",
        }

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Personal Access Token by querying DigitalOcean Account endpoint.
        """
        if not self.api_token:
            raise ValueError("DigitalOcean API Personal Access Token is required.")

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(f"{self.base_url}/account", headers=self._get_headers())
                if resp.status_code == 200:
                    account_data = resp.json().get("account", {})
                    email = account_data.get("email", "unknown")
                    uuid_str = account_data.get("uuid", "unknown")
                    droplet_limit = account_data.get("droplet_limit", 0)
                    logger.info(f"DigitalOcean account verified: {email} (Limit: {droplet_limit})")
                    return {
                        "valid": True,
                        "account_id": uuid_str,
                        "email": email,
                        "droplet_limit": droplet_limit,
                        "status": account_data.get("status", "active"),
                    }
                elif resp.status_code == 401:
                    raise ValueError("DigitalOcean API authentication failed: Invalid or expired Bearer Token (401).")
                else:
                    raise ValueError(f"DigitalOcean API returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"DigitalOcean credential validation error: {e}")
            raise ValueError(f"DigitalOcean validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Droplets via /v2/droplets.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/droplets?per_page=100", headers=self._get_headers())
                if resp.status_code == 200:
                    droplets = resp.json().get("droplets", [])
                    for d in droplets:
                        # Extract public/private IPv4
                        v4_nets = d.get("networks", {}).get("v4", [])
                        pub_ip = next((n["ip_address"] for n in v4_nets if n.get("type") == "public"), None)
                        priv_ip = next((n["ip_address"] for n in v4_nets if n.get("type") == "private"), None)
                        region_slug = d.get("region", {}).get("slug", "nyc1")

                        resources.append(DiscoveredResource(
                            resource_id=str(d.get("id")),
                            resource_name=d.get("name", "droplet"),
                            provider="digitalocean",
                            resource_type="virtual_machine",
                            region=region_slug,
                            zone=region_slug,
                            status="running" if d.get("status") == "active" else "stopped",
                            ip_address=pub_ip,
                            private_ip=priv_ip,
                            instance_type=d.get("size_slug", "s-1vcpu-1gb"),
                            tags={t: "true" for t in d.get("tags", [])},
                            raw_metadata={
                                "memory_mb": d.get("memory"),
                                "vcpus": d.get("vcpus"),
                                "disk_gb": d.get("disk"),
                            },
                        ))
        except Exception as e:
            logger.warning(f"DigitalOcean droplet discovery error: {e}")

        return resources

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Collect droplet CPU/Memory metrics using free DigitalOcean Monitoring API.
        """
        samples: List[UnifiedMetricSample] = []
        try:
            start_ts = int(start_time.timestamp())
            end_ts = int(end_time.timestamp())
            url = f"{self.base_url}/monitoring/metrics/droplet/cpu?host_id={resource.resource_id}&start={start_ts}&end={end_ts}"
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(url, headers=self._get_headers())
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    results = data.get("result", [])
                    if results:
                        values = results[0].get("values", [])
                        for ts, val in values[-5:]:
                            samples.append(UnifiedMetricSample(
                                provider="digitalocean",
                                resource_id=resource.resource_id,
                                resource_name=resource.resource_name,
                                region=resource.region,
                                status=resource.status,
                                cpu_usage_percent=float(val),
                                event_timestamp=datetime.fromtimestamp(float(ts), tz=timezone.utc),
                                source="digitalocean_monitoring",
                            ))
        except Exception as e:
            logger.debug(f"DigitalOcean metric ingestion debug: {e}")

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
