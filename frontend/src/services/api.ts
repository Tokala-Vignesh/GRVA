import {
  CloudConnection,
  CloudResource,
  MetricRecord,
  MonitoringOverview,
  Incident,
  RemediationAction,
  SystemHealth,
  OllamaModelsResponse,
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

  public createOCIConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/oci', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createDigitalOceanConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/digitalocean', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createHetznerConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/hetzner', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createRenderConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/render', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createCloudflareConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/cloudflare', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createVercelConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/vercel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createSupabaseConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/supabase', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createFlyioConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/flyio', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createDockerConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/docker', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public createKubernetesConnection(data: any): Promise<CloudConnection> {
    return this.request<CloudConnection>('/connections/kubernetes', {
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

  public getOllamaModels(): Promise<OllamaModelsResponse> {
    return this.request<OllamaModelsResponse>('/ai/models');
  }

  public setOllamaModel(model: string): Promise<{ status: string; active_model: string }> {
    return this.request<{ status: string; active_model: string }>('/ai/model', {
      method: 'POST',
      body: JSON.stringify({ model }),
    });
  }

  public askAI(query: string, resourceId?: string, model?: string): Promise<{ response: string; grounding_data: any; model_used: string }> {
    return this.request<any>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query, resource_id: resourceId, model }),
    });
  }

  public async askAIStream(
    query: string,
    model: string | undefined,
    resourceId: string | undefined,
    onToken: (token: string) => void,
    onDone: (modelUsed: string, grounding: any) => void,
    onError: (err: any) => void
  ): Promise<void> {
    await this.init();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.token) {
        headers['X-CloudSentinel-Token'] = this.token;
      }

      const response = await fetch(`${this.baseUrl}/ai/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, model, resource_id: resourceId }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream available in response.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.token) {
                onToken(data.token);
              }
              if (data.done) {
                onDone(data.model || 'local-ai', data.grounding);
              }
            } catch {
              // ignore malformed SSE line
            }
          }
        }
      }
    } catch (err: any) {
      onError(err);
    }
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
