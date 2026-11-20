export interface CloudConnection {
  id: string;
  name: string;
  provider: 'aws' | 'gcp' | 'azure' | 'private';
  account_id: string;
  region: string;
  status: 'connected' | 'error' | 'unverified' | 'disconnected';
  last_verified_at: string | null;
  last_sync_at: string | null;
  created_at: string;
}

export interface CloudResource {
  id: string;
  connection_id: string;
  provider: 'aws' | 'gcp' | 'azure' | 'private';
  resource_id: string;
  resource_name: string;
  resource_type: string;
  region: string;
  zone: string | null;
  status: 'running' | 'stopped' | 'warning' | 'critical' | 'unknown';
  ip_address: string | null;
  private_ip: string | null;
  instance_type: string | null;
  last_collected_at: string | null;
  latest_cpu: number | null;
  latest_mem: number | null;
  latest_disk: number | null;
}

export interface MetricRecord {
  timestamp: string;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
  disk_usage_percent: number | null;
  network_in_bytes: number | null;
  network_out_bytes: number | null;
  source: string;
}

export interface MonitoringOverview {
  total_connections: number;
  total_resources: number;
  healthy_resources: number;
  warning_resources: number;
  critical_resources: number;
  stopped_resources: number;
  active_incidents: number;
  provider_distribution: Record<string, number>;
  recent_security_events: Array<{
    name: string;
    provider: string;
    severity: string;
    time: string;
  }>;
  vault_backend: string;
  telemetry_series?: Array<{
    time: string;
    cpu: number | null;
    mem: number | null;
  }>;
}

export interface Incident {
  id: string;
  incident_number: string;
  title: string;
  description: string;
  provider: string;
  resource_id: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'acknowledged' | 'investigating' | 'awaiting_approval' | 'remediating' | 'resolved' | 'closed';
  root_cause: string | null;
  ai_investigation_status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface RemediationAction {
  id: string;
  incident_id: string | null;
  resource_id: string;
  action_type: string;
  target: string;
  risk_level: 'low' | 'medium' | 'high';
  status: 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'failed';
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  execution_output: string | null;
  created_at: string;
}

export interface AgentFinding {
  agent_name: string;
  summary: string;
  details: any;
  confidence: number;
}

export interface SystemHealth {
  status: string;
  database: string;
  keyring_vault: string;
  ollama: {
    available: boolean;
    version: string | null;
    base_url: string;
    error: string | null;
  };
}
