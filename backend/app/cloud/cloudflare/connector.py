import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.cloudflare")

class CloudflareConnector(BaseCloudConnector):
    """
    Cloudflare Edge & Serverless Connector.
    Interacts with Cloudflare API v4 for Workers and Pages projects.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.api_token = self.credentials.get("api_token", "")
        self.account_id = self.credentials.get("account_id", "")
        self.base_url = "https://api.cloudflare.com/client/v4"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "CloudSentinel-Agent/1.0",
        }

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Cloudflare API Token and Account ID.
        """
        if not self.api_token:
            raise ValueError("Cloudflare API Token is required.")
        if not self.account_id:
            raise ValueError("Cloudflare Account ID is required.")

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(f"{self.base_url}/accounts/{self.account_id}", headers=self._get_headers())
                if resp.status_code == 200:
                    data = resp.json().get("result", {})
                    account_name = data.get("name", "Cloudflare Account")
                    logger.info(f"Cloudflare account verified: {account_name} ({self.account_id})")
                    return {
                        "valid": True,
                        "account_id": self.account_id,
                        "account_name": account_name,
                        "status": "connected",
                    }
                elif resp.status_code == 401 or resp.status_code == 403:
                    raise ValueError(f"Cloudflare authentication failed (status {resp.status_code}): Invalid token or insufficient permissions.")
                else:
                    raise ValueError(f"Cloudflare API error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Cloudflare validation error: {e}")
            raise ValueError(f"Cloudflare validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Cloudflare Worker scripts and Pages projects.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=10.0) as client:
                # 1. Discover Workers
                w_resp = client.get(
                    f"{self.base_url}/accounts/{self.account_id}/workers/scripts",
                    headers=self._get_headers()
                )
                if w_resp.status_code == 200:
                    workers = w_resp.json().get("result", [])
                    for w in workers:
                        w_id = w.get("id", "worker")
                        resources.append(DiscoveredResource(
                            resource_id=f"cf-worker-{w_id}",
                            resource_name=w_id,
                            provider="cloudflare",
                            resource_type="serverless_worker",
                            region="global_edge",
                            status="running",
                            instance_type="v8_isolate",
                            tags={"usage_model": w.get("usage_model", "bundled")},
                            raw_metadata=w,
                        ))

                # 2. Discover Pages
                p_resp = client.get(
                    f"{self.base_url}/accounts/{self.account_id}/pages/projects",
                    headers=self._get_headers()
                )
                if p_resp.status_code == 200:
                    pages = p_resp.json().get("result", [])
                    for p in pages:
                        p_name = p.get("name", "pages-project")
                        subdomain = p.get("subdomain", "")
                        resources.append(DiscoveredResource(
                            resource_id=f"cf-pages-{p_name}",
                            resource_name=p_name,
                            provider="cloudflare",
                            resource_type="static_edge_site",
                            region="global_edge",
                            status="running",
                            ip_address=subdomain,
                            instance_type="cloudflare_pages",
                            raw_metadata=p,
                        ))
        except Exception as e:
            logger.warning(f"Cloudflare resource discovery error: {e}")

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
