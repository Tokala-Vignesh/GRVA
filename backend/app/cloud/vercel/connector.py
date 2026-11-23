import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.vercel")

class VercelConnector(BaseCloudConnector):
    """
    Vercel Cloud Platform Connector.
    Interacts with Vercel REST API v9 for frontend apps, preview branches, and serverless functions.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.api_token = self.credentials.get("api_token", "")
        self.team_id = self.credentials.get("team_id", "")
        self.base_url = "https://api.vercel.com"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "CloudSentinel-Agent/1.0",
        }

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Vercel Personal Access Token.
        """
        if not self.api_token:
            raise ValueError("Vercel Personal Access Token is required.")

        try:
            with httpx.Client(timeout=8.0) as client:
                url = f"{self.base_url}/v2/user"
                resp = client.get(url, headers=self._get_headers())
                if resp.status_code == 200:
                    user_data = resp.json().get("user", {})
                    username = user_data.get("username", "Vercel User")
                    email = user_data.get("email", "")
                    uid = user_data.get("id", f"vercel-{self.api_token[:8]}")
                    logger.info(f"Vercel account verified: {username} ({email})")
                    return {
                        "valid": True,
                        "account_id": uid,
                        "username": username,
                        "email": email,
                        "status": "connected",
                    }
                elif resp.status_code == 401:
                    raise ValueError("Vercel authentication failed: Invalid or expired Bearer Token (401).")
                else:
                    raise ValueError(f"Vercel API returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Vercel validation error: {e}")
            raise ValueError(f"Vercel validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Vercel projects via /v9/projects.
        """
        resources: List[DiscoveredResource] = []
        try:
            params = {}
            if self.team_id:
                params["teamId"] = self.team_id

            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/v9/projects?limit=50", headers=self._get_headers(), params=params)
                if resp.status_code == 200:
                    projects = resp.json().get("projects", [])
                    for p in projects:
                        p_id = p.get("id", "prj")
                        p_name = p.get("name", "vercel-project")
                        framework = p.get("framework", "nextjs")
                        latest_dep = p.get("latestDeployments", [{}])[0] if p.get("latestDeployments") else {}
                        dep_url = latest_dep.get("url", "")
                        ready_state = latest_dep.get("readyState", "READY").lower()
                        status_str = "running" if ready_state in ("ready", "building") else "warning"

                        resources.append(DiscoveredResource(
                            resource_id=p_id,
                            resource_name=p_name,
                            provider="vercel",
                            resource_type="serverless_app",
                            region="global_edge",
                            status=status_str,
                            ip_address=dep_url,
                            instance_type=framework or "nextjs",
                            tags={"framework": framework or "custom", "ready_state": ready_state},
                            raw_metadata=p,
                        ))
        except Exception as e:
            logger.warning(f"Vercel resource discovery error: {e}")

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
