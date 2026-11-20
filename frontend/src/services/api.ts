import {
  CloudConnection,
  CloudResource,
  MetricRecord,
  MonitoringOverview,
  Incident,
  RemediationAction,
  SystemHealth,
} from '../types';

declare global {
  interface Window {
    cloudSentinelDesktop?: {
      getBackendConfig: () => Promise<{ host: string; port: number; token: string }>;
      sendNotification: (title: string, body: string) => void;
      getAppVersion: () => Promise<string>;
      platform: string;
      openExternal: (url: string) => void;
    };
  }
}

class ApiService {
  private baseUrl: string = 'http://127.0.0.1:8765/api/v1';
  private token: string = '';
  private initialized: boolean = false;

  public async init(): Promise<void> {
    if (this.initialized && this.token) return;

    if (window.cloudSentinelDesktop) {
      try {
        const config = await window.cloudSentinelDesktop.getBackendConfig();
        if (config && config.token) {
          this.baseUrl = `http://${config.host || '127.0.0.1'}:${config.port || 8765}/api/v1`;
          this.token = config.token;
          this.initialized = true;
        }
      } catch (e) {
        console.warn('Could not retrieve desktop backend config, retrying:', e);
      }
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.init();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['X-CloudSentinel-Token'] = this.token;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const parsed = JSON.parse(errText);
        errorMsg = parsed.detail || errorMsg;
      } catch {
        errorMsg = errText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // Health & Overview
  public getHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/monitoring/health');
  }

  public getOverview(): Promise<MonitoringOverview> {
    return this.request<MonitoringOverview>('/monitoring/overview');
  }

  // Connections
  public getConnections(): Promise<CloudConnection[]> {
    return this.request<CloudConnection[]>('/connections');
  }

  public createAWSConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/aws', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createGCPConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/gcp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createAzureConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/azure', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createPrivateConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/private', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public testConnection(connId: string): Promise<any> {
    return this.request<any>(`/connections/${connId}/test`, { method: 'POST' });
  }

  public syncConnection(connId: string): Promise<any> {
    return this.request<any>(`/connections/${connId}/sync`, { method: 'POST' });
  }

  public deleteConnection(connId: string): Promise<any> {
    return this.request<any>(`/connections/${connId}`, { method: 'DELETE' });
  }

  // Resources
  public getResources(provider?: string, status?: string): Promise<CloudResource[]> {
    let url = '/resources?';
    if (provider) url += `provider=${encodeURIComponent(provider)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;
    return this.request<CloudResource[]>(url);
  }

  public getResource(id: string): Promise<CloudResource> {
    return this.request<CloudResource>(`/resources/${id}`);
  }

  public getResourceMetrics(id: string, limit: number = 100): Promise<MetricRecord[]> {
    return this.request<MetricRecord[]>(`/resources/${id}/metrics?limit=${limit}`);
  }

  public getResourceForecast(id: string, metricName: string = 'cpu_usage_percent'): Promise<any> {
    return this.request<any>(`/resources/${id}/forecast?metric_name=${metricName}`);
  }

  // Incidents
  public getIncidents(status?: string, severity?: string): Promise<Incident[]> {
    let url = '/incidents?';
    if (status) url += `status=${encodeURIComponent(status)}&`;
    if (severity) url += `severity=${encodeURIComponent(severity)}&`;
    return this.request<Incident[]>(url);
  }

  public createIncident(data: any): Promise<Incident> {
    return this.request<Incident>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public investigateIncident(id: string): Promise<any> {
    return this.request<any>(`/incidents/${id}/investigate`, { method: 'POST' });
  }

  // Remediation
  public getRemediationActions(): Promise<RemediationAction[]> {
    return this.request<RemediationAction[]>('/remediation/actions');
  }

  public approveRemediation(actionId: string): Promise<any> {
    return this.request<any>(`/remediation/${actionId}/approve`, { method: 'POST' });
  }

  public rejectRemediation(actionId: string): Promise<any> {
    return this.request<any>(`/remediation/${actionId}/reject`, { method: 'POST' });
  }

  // AI & Assistant
  public getOllamaStatus(): Promise<any> {
    return this.request<any>('/ai/status');
  }

  public getOllamaModels(): Promise<{ models: string[] }> {
    return this.request<{ models: string[] }>('/ai/models');
  }

  public askAI(query: string, resourceId?: string): Promise<{ response: string; grounding_data: any; model_used: string }> {
    return this.request<any>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query, resource_id: resourceId }),
    });
  }

  public investigateAI(data: any): Promise<any> {
    return this.request<any>('/ai/investigate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reports
  public getReport(reportType: string = 'infrastructure_health'): Promise<any> {
    return this.request<any>(`/reports?report_type=${reportType}`);
  }

  public exportReport(reportType: string, format: string): Promise<any> {
    return this.request<any>('/reports/export', {
      method: 'POST',
      body: JSON.stringify({ report_type: reportType, format }),
    });
  }

  // Settings
  public getSettings(): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('/settings');
  }

  public updateSettings(settings: Record<string, string>): Promise<any> {
    return this.request<any>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    });
  }

  public createBackup(): Promise<any> {
    return this.request<any>('/settings/backup', { method: 'POST' });
  }

  public restoreBackup(backupPath: string): Promise<any> {
    return this.request<any>('/settings/restore', {
      method: 'POST',
      body: JSON.stringify({ backup_path: backupPath }),
    });
  }
}

export const api = new ApiService();
