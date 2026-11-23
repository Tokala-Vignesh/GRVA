import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample

logger = logging.getLogger("cloudsentinel.cloud.docker")

class DockerConnector(BaseCloudConnector):
    """
    Docker Container Engine Connector.
    Interacts with local or remote Docker daemon REST API (/version, /containers/json, /containers/{id}/stats).
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        # Default to standard TCP daemon endpoint or local Windows/Unix socket
        raw_url = self.credentials.get("daemon_url", "http://127.0.0.1:2375").strip()
        if not raw_url.startswith("http://") and not raw_url.startswith("https://"):
            raw_url = f"http://{raw_url}"
        self.daemon_url = raw_url.rstrip("/")
        self.tls_verify = self.credentials.get("tls_verify", False)

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate Docker daemon connectivity via /version or /_ping.
        """
        try:
            with httpx.Client(timeout=4.0, verify=self.tls_verify) as client:
                resp = client.get(f"{self.daemon_url}/version")
                if resp.status_code == 200:
                    data = resp.json()
                    version = data.get("Version", "unknown")
                    os_type = data.get("Os", "unknown")
                    arch = data.get("Arch", "unknown")
                    logger.info(f"Docker Engine verified: Version {version} ({os_type}/{arch}) at {self.daemon_url}")
                    return {
                        "valid": True,
                        "account_id": f"docker-{version}",
                        "docker_version": version,
                        "os": os_type,
                        "arch": arch,
                        "status": "connected",
                    }
                else:
                    raise ValueError(f"Docker daemon returned HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"Docker daemon connection failed at {self.daemon_url}: {e}")
            raise ValueError(
                f"Could not connect to Docker Engine at '{self.daemon_url}': {str(e)}. "
                "Ensure Docker Desktop / daemon is running and 'Expose daemon on tcp://localhost:2375 without TLS' is enabled."
            )

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover Docker containers via /containers/json?all=1.
        """
        resources: List[DiscoveredResource] = []
        try:
            with httpx.Client(timeout=6.0, verify=self.tls_verify) as client:
                resp = client.get(f"{self.daemon_url}/containers/json?all=1")
                if resp.status_code == 200:
                    containers = resp.json()
                    for c in containers:
                        c_id = c.get("Id", "")[:12]
                        names = c.get("Names", ["/container"])
                        c_name = names[0].lstrip("/") if names else "container"
                        image = c.get("Image", "docker-image")
                        state = c.get("State", "running").lower()
                        status_str = "running" if state in ("running", "created") else "stopped"

                        # Extract ports
                        ports = [f"{p.get('PublicPort', '')}->{p.get('PrivatePort')}" for p in c.get("Ports", []) if p.get("PrivatePort")]
                        port_str = ", ".join(ports[:3])

                        resources.append(DiscoveredResource(
                            resource_id=f"docker-{c_id}",
                            resource_name=c_name,
                            provider="docker",
                            resource_type="container",
                            region="local_host",
                            zone="docker_engine",
                            status=status_str,
                            ip_address="127.0.0.1" if ports else None,
                            instance_type=image,
                            tags={"image": image, "ports": port_str},
                            raw_metadata=c,
                        ))
        except Exception as e:
            logger.warning(f"Docker container discovery error: {e}")

        return resources

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Collect real-time CPU & Memory usage via /containers/{id}/stats?stream=false.
        """
        samples: List[UnifiedMetricSample] = []
        try:
            container_id = resource.resource_id.replace("docker-", "")
            url = f"{self.daemon_url}/containers/{container_id}/stats?stream=false"
            with httpx.Client(timeout=4.0, verify=self.tls_verify) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    stats = resp.json()
                    # Calculate Docker CPU Percentage
                    cpu_stats = stats.get("cpu_stats", {})
                    precpu_stats = stats.get("precpu_stats", {})
                    cpu_delta = cpu_stats.get("cpu_usage", {}).get("total_usage", 0) - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
                    system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)
                    online_cpus = cpu_stats.get("online_cpus", 1) or 1
                    
                    cpu_percent = 0.0
                    if system_delta > 0 and cpu_delta > 0:
                        cpu_percent = (cpu_delta / system_delta) * online_cpus * 100.0

                    # Calculate Docker Memory Percentage
                    mem_stats = stats.get("memory_stats", {})
                    usage = mem_stats.get("usage", 0)
                    limit = mem_stats.get("limit", 1) or 1
                    mem_percent = (usage / limit) * 100.0 if limit > 0 else 0.0

                    samples.append(UnifiedMetricSample(
                        provider="docker",
                        resource_id=resource.resource_id,
                        resource_name=resource.resource_name,
                        region=resource.region,
                        status=resource.status,
                        cpu_usage_percent=round(cpu_percent, 2),
                        memory_usage_percent=round(mem_percent, 2),
                        event_timestamp=datetime.now(timezone.utc),
                        source="docker_engine_stats",
                    ))
        except Exception as e:
            logger.debug(f"Docker metric scrape debug: {e}")

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
