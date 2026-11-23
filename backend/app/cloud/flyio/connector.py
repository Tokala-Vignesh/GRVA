import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.flyio")

class FlyioConnector(BaseCloudConnector):
    """
    Fly.io MicroVM Connector.
    Interacts with Fly.io Machines REST API for distributed global Firecracker microVMs.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.api_token = self.credentials.get("api_token", "")
        self.base_url = "https://api.machines.dev/v1"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "CloudSentinel-Agent/1.0",
        }

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Fly.io API Token by listing registered apps.
        """
        if not self.api_token:
            raise ValueError("Fly.io API Token is required.")

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(f"{self.base_url}/apps", headers=self._get_headers())
                if resp.status_code == 200:
                    data = resp.json()
                    total_apps = data.get("total_apps", len(data.get("apps", [])))
                    logger.info(f"Fly.io token verified successfully ({total_apps} apps found)")
                    return {
                        "valid": True,
                        "account_id": f"fly-{self.api_token[:8]}",
                        "total_apps": total_apps,
                        "status": "connected",
                    }
                elif resp.status_code == 401 or resp.status_code == 403:
                    raise ValueError("Fly.io authentication failed: Invalid or expired API Token (401/403).")
                else:
                    raise ValueError(f"Fly.io Machines API returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Fly.io validation error: {e}")
            raise ValueError(f"Fly.io validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Fly.io applications and machines.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/apps", headers=self._get_headers())
                if resp.status_code == 200:
                    apps = resp.json().get("apps", [])
                    for a in apps:
                        app_name = a.get("name", "fly-app")
                        app_id = a.get("id", app_name)
                        st = a.get("status", "running")
                        org = a.get("organization", {}).get("slug", "personal")

                        resources.append(DiscoveredResource(
                            resource_id=f"fly-{app_id}",
                            resource_name=app_name,
                            provider="flyio",
                            resource_type="firecracker_microvm",
                            region="global_anycast",
                            status="running" if st in ("running", "deployed") else "stopped",
                            ip_address=f"{app_name}.fly.dev",
                            instance_type="microvm",
                            tags={"organization": org},
                            raw_metadata=a,
                        ))
        except Exception as e:
            logger.warning(f"Fly.io resource discovery error: {e}")

        return resources

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        return []

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
