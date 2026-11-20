from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator

class DiscoveredResource(BaseModel):
    """Normalized schema for a discovered cloud resource."""
    resource_id: str
    resource_name: str
    provider: str # 'aws', 'gcp', 'azure', 'private'
    resource_type: str = "virtual_machine"
    region: str
    zone: Optional[str] = None
    status: str # 'running', 'stopped', 'warning', 'critical', 'unknown'
    ip_address: Optional[str] = None
    private_ip: Optional[str] = None
    instance_type: Optional[str] = None
    tags: Dict[str, str] = Field(default_factory=dict)
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)


class UnifiedMetricSample(BaseModel):
    """
    Standardized provider-agnostic metric schema.
    Missing metrics are explicitly None (never substituted with 0).
    Percentages are normalized to 0.0 - 100.0.
    Network and disk rates are normalized to bytes.
    """
    provider: str
    resource_id: str
    resource_name: str
    resource_type: str = "virtual_machine"
    region: str
    status: str = "running"
    
    # Core Resource Metrics (nullable - never zero-fabricated)
    cpu_usage_percent: Optional[float] = None
    memory_usage_percent: Optional[float] = None
    disk_usage_percent: Optional[float] = None
    network_in_bytes: Optional[float] = None
    network_out_bytes: Optional[float] = None
    disk_read_bytes: Optional[float] = None
    disk_write_bytes: Optional[float] = None
    
    # Metadata & Provenance
    event_timestamp: datetime
    collected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: str # 'cloudwatch', 'gcp_monitoring', 'azure_monitor', 'node_exporter'
    freshness: str = "live" # 'live', 'cached', 'historical'
    raw_metric_names: List[str] = Field(default_factory=list)
    unsupported_metrics: List[str] = Field(default_factory=list)

    @field_validator("cpu_usage_percent", "memory_usage_percent", "disk_usage_percent")
    @classmethod
    def validate_percentages(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            # Bound percentages cleanly between 0.0 and 100.0
            return max(0.0, min(100.0, float(v)))
        return None

    @field_validator("network_in_bytes", "network_out_bytes", "disk_read_bytes", "disk_write_bytes")
    @classmethod
    def validate_non_negative_bytes(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return max(0.0, float(v))
        return None


class MetricNormalizer:
    """Normalizes raw metrics from various provider schemas into UnifiedMetricSample."""

    @staticmethod
    def normalize_aws(
        resource_id: str,
        resource_name: str,
        region: str,
        status: str,
        timestamp: datetime,
        cloudwatch_metrics: Dict[str, float],
        agent_installed: bool = False,
    ) -> UnifiedMetricSample:
        """
        Normalize AWS CloudWatch metric data.
        CloudWatch native metrics: CPUUtilization (%), NetworkIn (bytes), NetworkOut (bytes),
        DiskReadBytes (bytes), DiskWriteBytes (bytes).
        Memory and Disk % require CloudWatch Agent; if not present, they remain None.
        """
        cpu = cloudwatch_metrics.get("CPUUtilization")
        net_in = cloudwatch_metrics.get("NetworkIn")
        net_out = cloudwatch_metrics.get("NetworkOut")
        disk_read = cloudwatch_metrics.get("DiskReadBytes")
        disk_write = cloudwatch_metrics.get("DiskWriteBytes")

        # CloudWatch agent metrics (if agent installed)
        mem = cloudwatch_metrics.get("mem_used_percent") if agent_installed else None
        disk_util = cloudwatch_metrics.get("disk_used_percent") if agent_installed else None

        unsupported = []
        if not agent_installed:
            unsupported.extend(["memory_usage_percent", "disk_usage_percent"])

        return UnifiedMetricSample(
            provider="aws",
            resource_id=resource_id,
            resource_name=resource_name,
            region=region,
            status=status,
            cpu_usage_percent=cpu,
            memory_usage_percent=mem,
            disk_usage_percent=disk_util,
            network_in_bytes=net_in,
            network_out_bytes=net_out,
            disk_read_bytes=disk_read,
            disk_write_bytes=disk_write,
            event_timestamp=timestamp,
            source="cloudwatch",
            freshness="live",
            raw_metric_names=list(cloudwatch_metrics.keys()),
            unsupported_metrics=unsupported,
        )

    @staticmethod
    def normalize_gcp(
        resource_id: str,
        resource_name: str,
        region: str,
        status: str,
        timestamp: datetime,
        monitoring_metrics: Dict[str, float],
        ops_agent_installed: bool = False,
    ) -> UnifiedMetricSample:
        """
        Normalize Google Cloud Monitoring metric data.
        Compute metrics: compute.googleapis.com/instance/cpu/utilization (fraction 0.0 - 1.0) -> scaled to 0-100%
        compute.googleapis.com/instance/network/received_bytes_count -> bytes
        compute.googleapis.com/instance/network/sent_bytes_count -> bytes
        Ops agent: agent.googleapis.com/memory/percent_used -> %
        """
        raw_cpu = monitoring_metrics.get("cpu_utilization")
        # GCP native CPU utilization is 0.0 - 1.0 fraction
        cpu = (raw_cpu * 100.0) if raw_cpu is not None else None

        net_in = monitoring_metrics.get("network_in_bytes")
        net_out = monitoring_metrics.get("network_out_bytes")
        disk_read = monitoring_metrics.get("disk_read_bytes")
        disk_write = monitoring_metrics.get("disk_write_bytes")

        mem = monitoring_metrics.get("memory_percent_used") if ops_agent_installed else None
        disk_util = monitoring_metrics.get("disk_percent_used") if ops_agent_installed else None

        unsupported = []
        if not ops_agent_installed:
            unsupported.extend(["memory_usage_percent", "disk_usage_percent"])

        return UnifiedMetricSample(
            provider="gcp",
            resource_id=resource_id,
            resource_name=resource_name,
            region=region,
            status=status,
            cpu_usage_percent=cpu,
            memory_usage_percent=mem,
            disk_usage_percent=disk_util,
            network_in_bytes=net_in,
            network_out_bytes=net_out,
            disk_read_bytes=disk_read,
            disk_write_bytes=disk_write,
            event_timestamp=timestamp,
            source="gcp_monitoring",
            freshness="live",
            raw_metric_names=list(monitoring_metrics.keys()),
            unsupported_metrics=unsupported,
        )

    @staticmethod
    def normalize_azure(
        resource_id: str,
        resource_name: str,
        region: str,
        status: str,
        timestamp: datetime,
        azure_monitor_metrics: Dict[str, float],
        ama_agent_installed: bool = False,
    ) -> UnifiedMetricSample:
        """
        Normalize Azure Monitor metrics.
        Percentage CPU (0 - 100%)
        Network In Total (bytes)
        Network Out Total (bytes)
        Disk Read Bytes / Disk Write Bytes
        """
        cpu = azure_monitor_metrics.get("Percentage CPU")
        net_in = azure_monitor_metrics.get("Network In Total")
        net_out = azure_monitor_metrics.get("Network Out Total")
        disk_read = azure_monitor_metrics.get("Disk Read Bytes")
        disk_write = azure_monitor_metrics.get("Disk Write Bytes")

        mem = azure_monitor_metrics.get("Available Memory Bytes") if ama_agent_installed else None
        disk_util = azure_monitor_metrics.get("OS Disk Percent Used") if ama_agent_installed else None

        unsupported = []
        if not ama_agent_installed:
            unsupported.extend(["memory_usage_percent", "disk_usage_percent"])

        return UnifiedMetricSample(
            provider="azure",
            resource_id=resource_id,
            resource_name=resource_name,
            region=region,
            status=status,
            cpu_usage_percent=cpu,
            memory_usage_percent=mem,
            disk_usage_percent=disk_util,
            network_in_bytes=net_in,
            network_out_bytes=net_out,
            disk_read_bytes=disk_read,
            disk_write_bytes=disk_write,
            event_timestamp=timestamp,
            source="azure_monitor",
            freshness="live",
            raw_metric_names=list(azure_monitor_metrics.keys()),
            unsupported_metrics=unsupported,
        )

    @staticmethod
    def normalize_private_node(
        resource_id: str,
        resource_name: str,
        region: str,
        status: str,
        timestamp: datetime,
        node_metrics: Dict[str, float],
    ) -> UnifiedMetricSample:
        """
        Normalize Prometheus / Node Exporter metrics.
        All metrics (CPU, RAM, Disk, Network) are directly available from node_exporter.
        """
        return UnifiedMetricSample(
            provider="private",
            resource_id=resource_id,
            resource_name=resource_name,
            region=region or "on-premise",
            status=status,
            cpu_usage_percent=node_metrics.get("cpu_percent"),
            memory_usage_percent=node_metrics.get("memory_percent"),
            disk_usage_percent=node_metrics.get("disk_percent"),
            network_in_bytes=node_metrics.get("network_rx_bytes"),
            network_out_bytes=node_metrics.get("network_tx_bytes"),
            disk_read_bytes=node_metrics.get("disk_read_bytes"),
            disk_write_bytes=node_metrics.get("disk_write_bytes"),
            event_timestamp=timestamp,
            source="node_exporter",
            freshness="live",
            raw_metric_names=list(node_metrics.keys()),
            unsupported_metrics=[],
        )
