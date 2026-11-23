from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

# Cloud Connection Schemas
class AWSConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_session_token: Optional[str] = None
    role_arn: Optional[str] = None
    region: str = "us-east-1"

class GCPConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    project_id: str
    service_account_json: Optional[str] = None
    service_account_file: Optional[str] = None
    region: str = "us-central1"

class AzureConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    subscription_id: str
    tenant_id: str
    client_id: str
    client_secret: str
    region: str = "eastus"

class PrivateConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    endpoint_url: str = "http://127.0.0.1:9100/metrics"
    auth_token: Optional[str] = None
    host_name: Optional[str] = None
    region: str = "on-premise"

class OCIConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    tenancy_ocid: str
    user_ocid: Optional[str] = None
    fingerprint: Optional[str] = None
    private_key: Optional[str] = None
    region: str = "us-ashburn-1"

class DigitalOceanConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_token: str

class HetznerConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_token: str

class RenderConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_key: str

class CloudflareConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_token: str
    account_id: str

class VercelConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_token: str
    team_id: Optional[str] = None

class SupabaseConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_token: str

class FlyioConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_token: str

class DockerConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    daemon_url: str = "tcp://127.0.0.1:2375" # or npipe:////./pipe/docker_engine
    tls_verify: bool = False

class KubernetesConnectionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    api_server_url: str = "https://127.0.0.1:6443"
    bearer_token: Optional[str] = None
    kubeconfig_content: Optional[str] = None
    namespace: str = "default"

class ConnectionResponse(BaseModel):
    id: str
    name: str
    provider: str
    account_id: str
    region: str
    status: str
    last_verified_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime

# Resource Schemas
class ResourceResponse(BaseModel):
    id: str
    connection_id: str
    provider: str
    resource_id: str
    resource_name: str
    resource_type: str
    region: str
    zone: Optional[str] = None
    status: str
    ip_address: Optional[str] = None
    private_ip: Optional[str] = None
    instance_type: Optional[str] = None
    last_collected_at: Optional[datetime] = None
    latest_cpu: Optional[float] = None
    latest_mem: Optional[float] = None
    latest_disk: Optional[float] = None

# Metric Schemas
class MetricRecord(BaseModel):
    timestamp: datetime
    cpu_usage_percent: Optional[float] = None
    memory_usage_percent: Optional[float] = None
    disk_usage_percent: Optional[float] = None
    network_in_bytes: Optional[float] = None
    network_out_bytes: Optional[float] = None
    source: str

# Incident Schemas
class IncidentCreate(BaseModel):
    title: str
    description: str
    provider: str
    resource_id: Optional[str] = None
    severity: str = "medium"

class IncidentResponse(BaseModel):
    id: str
    incident_number: str
    title: str
    description: str
    provider: str
    resource_id: Optional[str] = None
    severity: str
    status: str
    root_cause: Optional[str] = None
    ai_investigation_status: str
    created_at: datetime
    updated_at: datetime

# Remediation Schemas
class RemediationResponse(BaseModel):
    id: str
    incident_id: Optional[str] = None
    resource_id: str
    action_type: str
    target: str
    risk_level: str
    status: str
    requires_approval: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    execution_output: Optional[str] = None
    created_at: datetime

# AI Schemas
class AIChatRequest(BaseModel):
    query: str
    resource_id: Optional[str] = None
    model: Optional[str] = None

class AIChatResponse(BaseModel):
    response: str
    grounding_data: Dict[str, Any]
    model_used: str

class AIModelSwitchRequest(BaseModel):
    model: str

class OllamaModelItem(BaseModel):
    name: str
    is_remote: bool = False
    parameter_size: Optional[str] = None
    quantization_level: Optional[str] = None
    size: Optional[int] = None
    family: Optional[str] = None

class OllamaModelsResponse(BaseModel):
    models: List[str]
    details: List[OllamaModelItem]

class AIInvestigateRequest(BaseModel):
    incident_id: Optional[str] = None
    resource_id: Optional[str] = None
    query: Optional[str] = None

# Settings Schemas
class SettingsUpdate(BaseModel):
    settings: Dict[str, str]

class ExportReportRequest(BaseModel):
    report_type: str = "infrastructure_health" # "infrastructure_health", "incidents", "security_events"
    format: str = "json" # "json", "csv", "pdf"
