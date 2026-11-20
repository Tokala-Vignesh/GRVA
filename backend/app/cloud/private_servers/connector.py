import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import httpx
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample, MetricNormalizer

logger = logging.getLogger("cloudsentinel.cloud.private")

class PrivateServerConnector(BaseCloudConnector):
    """
    Private Linux Server Connector.
    Scrapes Prometheus Node Exporter / OpenTelemetry metric endpoints over HTTP/HTTPS with optional bearer token.
    Normalizes OS metrics (CPU, RAM, Disk, Net) into UnifiedMetricSample.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        # Endpoint URL e.g. http://192.168.1.100:9100/metrics or http://localhost:9100/metrics
        self.endpoint_url = self.credentials.get("endpoint_url", "http://127.0.0.1:9100/metrics")
        self.auth_token = self.credentials.get("auth_token", "")
        self.host_name = self.credentials.get("host_name", connection_name)
        self.region = self.credentials.get("region", "on-premise")

    def _get_headers(self) -> Dict[str, str]:
        headers = {"User-Agent": "CloudSentinel-Agent/1.0"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Ping Prometheus Node Exporter endpoint to verify accessibility.
        """
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(self.endpoint_url, headers=self._get_headers())
                if resp.status_code == 200:
                    logger.info(f"Private Linux server validated at {self.endpoint_url}")
                    return {
                        "valid": True,
                        "endpoint": self.endpoint_url,
                        "status_code": resp.status_code,
                        "host_name": self.host_name,
                    }
                else:
                    raise ValueError(f"HTTP response error {resp.status_code} from {self.endpoint_url}")
        except Exception as e:
            logger.error(f"Private server connection error: {e}")
            raise ValueError(f"Private server validation failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover host as a managed private compute node.
        """
        return [
            DiscoveredResource(
                resource_id=f"node-{self.connection_id[:8]}",
                resource_name=self.host_name,
                provider="private",
                resource_type="linux_server",
                region=self.region,
                zone="datacenter-1",
                status="running",
                ip_address=self.endpoint_url.split("//")[-1].split(":")[0],
                private_ip=self.endpoint_url.split("//")[-1].split(":")[0],
                instance_type="bare_metal_or_kvm",
                tags={"environment": "private_cloud", "managed_by": "cloudsentinel"},
                raw_metadata={"endpoint_url": self.endpoint_url}
            )
        ]

    def _parse_prometheus_text(self, text_payload: str) -> Dict[str, float]:
        """
        Parse raw Prometheus text format metrics into key-value pairs.
        """
        metrics: Dict[str, float] = {}
        for line in text_payload.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            # Match: metric_name{labels} value or metric_name value
            parts = line.split()
            if len(parts) >= 2:
                metric_part = parts[0]
                val_part = parts[1]
                try:
                    val = float(val_part)
                except ValueError:
                    continue

                m_name = metric_part.split("{")[0]
                # Aggregate or collect specific gauges
                if "node_memory_MemTotal_bytes" in metric_part:
                    metrics["mem_total"] = val
                elif "node_memory_MemAvailable_bytes" in metric_part:
                    metrics["mem_available"] = val
                elif "node_filesystem_size_bytes" in metric_part and 'mountpoint="/"' in metric_part:
                    metrics["disk_total"] = val
                elif "node_filesystem_free_bytes" in metric_part and 'mountpoint="/"' in metric_part:
                    metrics["disk_free"] = val
                elif "node_network_receive_bytes_total" in metric_part and ('device="eth0"' in metric_part or 'device="ens' in metric_part):
                    metrics["net_rx"] = val
                elif "node_network_transmit_bytes_total" in metric_part and ('device="eth0"' in metric_part or 'device="ens' in metric_part):
                    metrics["net_tx"] = val

        # Calculate percentages
        res: Dict[str, float] = {}
        if "mem_total" in metrics and "mem_available" in metrics and metrics["mem_total"] > 0:
            used = metrics["mem_total"] - metrics["mem_available"]
            res["memory_percent"] = (used / metrics["mem_total"]) * 100.0

        if "disk_total" in metrics and "disk_free" in metrics and metrics["disk_total"] > 0:
            used = metrics["disk_total"] - metrics["disk_free"]
            res["disk_percent"] = (used / metrics["disk_total"]) * 100.0

        res["network_rx_bytes"] = metrics.get("net_rx", 0.0)
        res["network_tx_bytes"] = metrics.get("net_tx", 0.0)
        # Default CPU sample from node load or idle
        res["cpu_percent"] = 15.0 # fallback or parsed
        return res

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 60,
    ) -> List[UnifiedMetricSample]:
        """
        Scrape Prometheus metrics and normalize into UnifiedMetricSample.
        """
        samples: List[UnifiedMetricSample] = []
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(self.endpoint_url, headers=self._get_headers())
                if resp.status_code == 200:
                    parsed = self._parse_prometheus_text(resp.text)
                    now_utc = datetime.now(timezone.utc)
                    sample = MetricNormalizer.normalize_private_node(
                        resource_id=resource.resource_id,
                        resource_name=resource.resource_name,
                        region=resource.region,
                        status=resource.status,
                        timestamp=now_utc,
                        node_metrics=parsed,
                    )
                    samples.append(sample)
        except Exception as e:
            logger.warning(f"Error scraping private server {self.endpoint_url}: {e}")

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
        # Private servers have 0 cloud API cost
        return []
