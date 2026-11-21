import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.supabase")

class SupabaseConnector(BaseCloudConnector):
    """
    Supabase Cloud Database Connector.
    Interacts with Supabase Management API v1 for Postgres projects and edge functions.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.api_token = self.credentials.get("api_token", "")
        self.base_url = "https://api.supabase.com/v1"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "CloudSentinel-Agent/1.0",
        }

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Supabase Personal Access Token by listing projects.
        """
        if not self.api_token:
            raise ValueError("Supabase Personal Access Token is required.")

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(f"{self.base_url}/projects", headers=self._get_headers())
                if resp.status_code == 200:
                    projects = resp.json()
                    logger.info(f"Supabase connection validated successfully ({len(projects)} projects)")
                    return {
                        "valid": True,
                        "account_id": f"supabase-{self.api_token[:8]}",
                        "total_projects": len(projects),
                        "status": "connected",
                    }
                elif resp.status_code == 401:
                    raise ValueError("Supabase authentication failed: Invalid Access Token (401).")
                else:
                    raise ValueError(f"Supabase API returned error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Supabase validation error: {e}")
            raise ValueError(f"Supabase validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Supabase PostgreSQL database instances.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/projects", headers=self._get_headers())
                if resp.status_code == 200:
                    projects = resp.json()
                    for p in projects:
                        ref = p.get("id", "db")
                        name = p.get("name", "supabase-db")
                        region = p.get("region", "us-east-1")
                        st = p.get("status", "ACTIVE_HEALTHY")
                        status_str = "running" if st == "ACTIVE_HEALTHY" else "stopped"
                        db_host = f"db.{ref}.supabase.co"

                        resources.append(DiscoveredResource(
                            resource_id=f"supabase-{ref}",
                            resource_name=name,
                            provider="supabase",
                            resource_type="managed_postgres",
                            region=region,
                            status=status_str,
                            ip_address=db_host,
                            instance_type="postgres_instance",
                            tags={"organization_id": p.get("organization_id", "")},
                            raw_metadata=p,
                        ))
        except Exception as e:
            logger.warning(f"Supabase discovery error: {e}")

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
