import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)

def generate_uuid() -> str:
    return str(uuid.uuid4())


class CloudConnection(Base):
    __tablename__ = "cloud_connections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False, index=True)
    provider = Column(String(20), nullable=False) # 'aws', 'gcp', 'azure', 'private'
    account_id = Column(String(100), nullable=False) # AWS Account ID, GCP Project ID, Azure Sub ID
    credential_ref = Column(String(100), nullable=False) # Keyring reference
    region = Column(String(50), nullable=False, default="us-east-1")
    status = Column(String(20), nullable=False, default="unverified") # 'connected', 'error', 'unverified', 'disconnected'
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)

    resources = relationship("CloudResource", back_populates="connection", cascade="all, delete-orphan")
    cost_records = relationship("CostRecord", back_populates="connection", cascade="all, delete-orphan")
    collection_jobs = relationship("CollectionJob", back_populates="connection", cascade="all, delete-orphan")


class CloudResource(Base):
    __tablename__ = "cloud_resources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    connection_id = Column(String(36), ForeignKey("cloud_connections.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(20), nullable=False, index=True)
    resource_id = Column(String(100), nullable=False, index=True) # e.g. 'i-1234567890abcdef0'
    resource_name = Column(String(150), nullable=False)
    resource_type = Column(String(50), nullable=False, default="virtual_machine")
    region = Column(String(50), nullable=False)
    zone = Column(String(50), nullable=True)
    status = Column(String(30), nullable=False, default="unknown") # 'running', 'stopped', 'warning', 'critical'
    ip_address = Column(String(45), nullable=True)
    private_ip = Column(String(45), nullable=True)
    instance_type = Column(String(50), nullable=True)
    last_collected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("connection_id", "resource_id", name="uq_connection_resource_id"),
        Index("idx_resource_provider_status", "provider", "status"),
    )

    connection = relationship("CloudConnection", back_populates="resources")
    metrics = relationship("InfrastructureMetric", back_populates="resource", cascade="all, delete-orphan")
    aggregates = relationship("ResourceMetricAggregate", back_populates="resource", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="resource", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="resource")
    remediations = relationship("RemediationAction", back_populates="resource")
    metadata_rel = relationship("CloudResourceMetadata", back_populates="resource", uselist=False, cascade="all, delete-orphan")


class InfrastructureMetric(Base):
    __tablename__ = "infrastructure_metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    cpu_usage_percent = Column(Float, nullable=True)
    memory_usage_percent = Column(Float, nullable=True)
    disk_usage_percent = Column(Float, nullable=True)
    network_in_bytes = Column(Float, nullable=True)
    network_out_bytes = Column(Float, nullable=True)
    disk_read_bytes = Column(Float, nullable=True)
    disk_write_bytes = Column(Float, nullable=True)
    source = Column(String(30), nullable=False, default="cloudwatch")
    freshness = Column(String(20), nullable=False, default="live")
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    __table_args__ = (
        Index("idx_metric_resource_timestamp", "resource_id", "timestamp"),
    )

    resource = relationship("CloudResource", back_populates="metrics")


class ResourceMetricAggregate(Base):
    __tablename__ = "resource_metric_aggregates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    metric_name = Column(String(50), nullable=False)
    avg_val = Column(Float, nullable=False)
    min_val = Column(Float, nullable=False)
    max_val = Column(Float, nullable=False)
    sample_count = Column(Integer, nullable=False)

    resource = relationship("CloudResource", back_populates="aggregates")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("cloud_resources.id", ondelete="SET NULL"), nullable=True, index=True)
    rule_name = Column(String(100), nullable=False)
    metric_name = Column(String(50), nullable=False)
    threshold = Column(Float, nullable=False)
    observed_value = Column(Float, nullable=False)
    severity = Column(String(20), nullable=False, default="medium") # 'critical', 'high', 'medium', 'low', 'info'
    status = Column(String(20), nullable=False, default="firing") # 'firing', 'resolved', 'acknowledged'
    triggered_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    resource = relationship("CloudResource", back_populates="alerts")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_number = Column(String(30), unique=True, nullable=False, index=True) # e.g. "INC-1001"
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    provider = Column(String(20), nullable=False)
    resource_id = Column(String(36), ForeignKey("cloud_resources.id", ondelete="SET NULL"), nullable=True, index=True)
    severity = Column(String(20), nullable=False, default="medium") # 'critical', 'high', 'medium', 'low', 'info'
    status = Column(String(30), nullable=False, default="open") # 'open', 'acknowledged', 'investigating', 'awaiting_approval', 'remediating', 'resolved', 'closed'
    root_cause = Column(Text, nullable=True)
    ai_investigation_status = Column(String(30), nullable=False, default="pending") # 'pending', 'running', 'completed', 'failed'
    recommended_action = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    resource = relationship("CloudResource", back_populates="incidents")
    investigations = relationship("IncidentInvestigation", back_populates="incident", cascade="all, delete-orphan")
    remediations = relationship("RemediationAction", back_populates="incident")


class IncidentInvestigation(Base):
    __tablename__ = "incident_investigations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_name = Column(String(80), nullable=False) # e.g. "RootCauseAnalysisAgent"
    reasoning_trace = Column(Text, nullable=False)
    findings = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=False, default=0.0) # 0.0 to 1.0
    evidence_data = Column(Text, nullable=True) # JSON payload string
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    incident = relationship("Incident", back_populates="investigations")


class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    resource_id = Column(String(36), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False) # 'restart_service', 'restart_container', 'send_notification', 'recommend_resize'
    target = Column(String(100), nullable=False) # e.g. 'nginx.service'
    parameters = Column(Text, nullable=True) # JSON params
    risk_level = Column(String(20), nullable=False, default="low") # 'low', 'medium', 'high'
    status = Column(String(30), nullable=False, default="pending_approval") # 'pending_approval', 'approved', 'rejected', 'executed', 'failed'
    requires_approval = Column(Boolean, nullable=False, default=True)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    execution_output = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    incident = relationship("Incident", back_populates="remediations")
    resource = relationship("CloudResource", back_populates="remediations")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(20), nullable=False, index=True)
    event_name = Column(String(100), nullable=False)
    source_ip = Column(String(45), nullable=True)
    actor = Column(String(100), nullable=True)
    resource_arn = Column(String(200), nullable=True)
    risk_score = Column(Float, nullable=False, default=0.0)
    severity = Column(String(20), nullable=False, default="low")
    details = Column(Text, nullable=True) # JSON string
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)


class CostRecord(Base):
    __tablename__ = "cost_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    connection_id = Column(String(36), ForeignKey("cloud_connections.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(20), nullable=False, index=True)
    service_name = Column(String(100), nullable=False)
    region = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    billing_period_start = Column(DateTime(timezone=True), nullable=False)
    billing_period_end = Column(DateTime(timezone=True), nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    connection = relationship("CloudConnection", back_populates="cost_records")


class CollectionJob(Base):
    __tablename__ = "collection_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_type = Column(String(30), nullable=False) # 'discovery', 'metrics', 'logs', 'billing', 'cleanup'
    connection_id = Column(String(36), ForeignKey("cloud_connections.id", ondelete="CASCADE"), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="running") # 'running', 'success', 'failed', 'retrying'
    records_ingested = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    connection = relationship("CloudConnection", back_populates="collection_jobs")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)


class ApplicationSetting(Base):
    __tablename__ = "application_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    category = Column(String(30), nullable=False, default="general")
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    action = Column(String(100), nullable=False)
    actor = Column(String(50), nullable=False, default="system")
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=get_utc_now, nullable=False, index=True)


class MLModelMetadata(Base):
    __tablename__ = "ml_model_metadata"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    model_name = Column(String(100), nullable=False, index=True)
    model_type = Column(String(50), nullable=False) # 'isolation_forest', 'exponential_smoothing'
    target_resource_id = Column(String(36), ForeignKey("cloud_resources.id", ondelete="CASCADE"), nullable=True, index=True)
    version = Column(String(30), nullable=False, default="1.0.0")
    artifact_path = Column(String(255), nullable=False)
    training_sample_count = Column(Integer, nullable=False, default=0)
    metrics_accuracy = Column(Text, nullable=True)
    trained_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)


class CloudResourceMetadata(Base):
    __tablename__ = "cloud_resource_metadata"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    resource_id = Column(String(36), ForeignKey("cloud_resources.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    tags = Column(Text, nullable=True) # JSON dictionary
    configuration = Column(Text, nullable=True) # JSON dictionary
    os_details = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)

    resource = relationship("CloudResource", back_populates="metadata_rel")
