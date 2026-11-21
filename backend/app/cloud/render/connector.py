import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.render")

class RenderConnector(BaseCloudConnector):
    """
    Render Developer PaaS Connector.
    Interacts with Render REST API v1 for web services, background workers, and databases.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.api_key = self.credentials.get("api_key", "")
        self.base_url = "https://api.render.com/v1"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "User-Agent": "CloudSentinel-Agent/1.0",
        }

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Render API Key by querying owners/services.
        """
        if not self.api_key:
            raise ValueError("Render API Key is required.")

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(f"{self.base_url}/owners?limit=1", headers=self._get_headers())
                if resp.status_code == 200:
                    owners = resp.json()
                    owner_name = owners[0].get("owner", {}).get("name", "Render User") if owners else "Render User"
                    owner_email = owners[0].get("owner", {}).get("email", "") if owners else ""
                    logger.info(f"Render account validated: {owner_name} ({owner_email})")
                    return {
                        "valid": True,
                        "account_id": f"render-{self.api_key[:8]}",
                        "owner_name": owner_name,
                        "owner_email": owner_email,
                        "status": "connected",
                    }
                elif resp.status_code == 401:
                    raise ValueError("Render authentication failed: Invalid or expired API Key (401).")
                else:
                    raise ValueError(f"Render API returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Render validation error: {e}")
            raise ValueError(f"Render validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Render web services, static sites, background workers.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/services?limit=100", headers=self._get_headers())
                if resp.status_code == 200:
                    services = resp.json()
                    for item in services:
                        svc = item.get("service", {})
                        svc_id = svc.get("id", f"render-{self.connection_id[:6]}")
                        svc_name = svc.get("name", "render-service")
                        svc_type = svc.get("type", "web_service")
                        svc_details = svc.get("serviceDetails", {})
                        region = svc_details.get("region", "oregon")
                        env = svc_details.get("env", "docker")
                        suspended = svc.get("suspended", "not_suspended")
                        status_str = "stopped" if suspended == "suspended" else "running"

                        resources.append(DiscoveredResource(
                            resource_id=svc_id,
                            resource_name=svc_name,
                            provider="render",
                            resource_type=svc_type,
                            region=region,
                            status=status_str,
                            instance_type=svc_details.get("plan", "starter"),
                            ip_address=svc_details.get("url"),
                            tags={"environment": env, "suspended": suspended},
                            raw_metadata=svc,
                        ))
        except Exception as e:
            logger.warning(f"Render service discovery error: {e}")

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
