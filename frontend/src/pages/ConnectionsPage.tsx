import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { CloudConnection } from '../types';
import {
  Cloud,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Lock,
  ExternalLink,
} from 'lucide-react';

export const ConnectionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'aws' | 'gcp' | 'azure' | 'private'>('aws');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});

  // Form States
  const [awsForm, setAwsForm] = useState({
    name: '',
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_session_token: '',
    role_arn: '',
    region: 'us-east-1',
  });

  const [gcpForm, setGcpForm] = useState({
    name: '',
    project_id: '',
    service_account_json: '',
    region: 'us-central1',
  });

  const [azureForm, setAzureForm] = useState({
    name: '',
    subscription_id: '',
    tenant_id: '',
    client_id: '',
    client_secret: '',
    region: 'eastus',
  });

  const [privateForm, setPrivateForm] = useState({
    name: '',
    endpoint_url: 'http://127.0.0.1:9100/metrics',
    auth_token: '',
    host_name: '',
    region: 'on-premise',
  });

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections-list'],
    queryFn: () => api.getConnections(),
  });

  // Mutations
  const createConnMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === 'aws') return api.createAWSConnection(awsForm);
      if (activeTab === 'gcp') return api.createGCPConnection(gcpForm);
      if (activeTab === 'azure') return api.createAzureConnection(azureForm);
      if (activeTab === 'private') return api.createPrivateConnection(privateForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections-list'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-overview'] });
      setShowAddModal(false);
    },
  });

  const deleteConnMutation = useMutation({
    mutationFn: (id: string) => api.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections-list'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-overview'] });
    },
  });

  const testConnMutation = useMutation({
    mutationFn: (id: string) => api.testConnection(id),
    onSuccess: (data, id) => {
      setTestResult((prev) => ({ ...prev, [id]: data }));
      queryClient.invalidateQueries({ queryKey: ['connections-list'] });
    },
  });

  const syncConnMutation = useMutation({
    mutationFn: (id: string) => api.syncConnection(id),
    onSuccess: (_, id) => {
      setSyncStatus((prev) => ({ ...prev, [id]: 'Syncing...' }));
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['connections-list'] });
        queryClient.invalidateQueries({ queryKey: ['resources-list'] });
        queryClient.invalidateQueries({ queryKey: ['monitoring-overview'] });
        setSyncStatus((prev) => ({ ...prev, [id]: 'Done' }));
      }, 2500);
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Cloud & Infrastructure Connections</h2>
          <p className="text-xs text-slate-400">
            Connect your AWS, GCP, Azure, and private Linux server credentials. Stored securely in OS Keyring.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          Add Connection
        </button>
      </div>

      {/* Connected Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(connections || []).map((conn) => (
          <div
            key={conn.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden"
          >
            {/* Provider accent top stripe */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${
                conn.provider === 'aws'
                  ? 'bg-amber-500'
                  : conn.provider === 'gcp'
                  ? 'bg-blue-500'
                  : conn.provider === 'azure'
                  ? 'bg-cyan-500'
                  : 'bg-emerald-500'
              }`}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {conn.provider}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    conn.status === 'connected'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {conn.status === 'connected' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {conn.status}
                </span>
              </div>

              <h3 className="font-semibold text-sm text-slate-100 mb-1">{conn.name}</h3>
              <p className="text-xs text-slate-400 font-mono truncate mb-2">ID: {conn.account_id}</p>
              <div className="text-[11px] text-slate-500 space-y-1 mb-4">
                <div>Region: {conn.region}</div>
                <div>Last Verified: {conn.last_verified_at ? new Date(conn.last_verified_at).toLocaleTimeString() : 'Never'}</div>
              </div>
            </div>

            {testResult[conn.id] && (
              <div className="mb-3 p-2 rounded bg-slate-950 border border-slate-800 text-[11px]">
                <span className={testResult[conn.id].status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                  {testResult[conn.id].status === 'success' ? '✓ Authenticated successfully' : `✕ ${testResult[conn.id].error}`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testConnMutation.mutate(conn.id)}
                  disabled={testConnMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                  title="Test authentication against cloud provider"
                >
                  <RefreshCw className={`w-3 h-3 ${testConnMutation.isPending ? 'animate-spin' : ''}`} />
                  Test
                </button>

                <button
                  onClick={() => syncConnMutation.mutate(conn.id)}
                  disabled={syncConnMutation.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium transition"
                  title="Trigger immediate resource discovery"
                >
                  <Server className={`w-3 h-3 ${syncConnMutation.isPending ? 'animate-pulse' : ''}`} />
                  {syncStatus[conn.id] || 'Sync'}
                </button>
              </div>

              <button
                onClick={() => deleteConnMutation.mutate(conn.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="Delete Connection"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {(!connections || connections.length === 0) && (
          <div className="col-span-full py-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-xl">
            <Cloud className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-medium">No Cloud Connections Configured</p>
            <p className="text-xs text-slate-500 mb-4">Add your AWS, GCP, Azure, or Private server to start monitoring.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Connection
            </button>
          </div>
        )}
      </div>

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-slate-100 text-sm">Add Cloud Provider Connection</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Provider Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              {(['aws', 'gcp', 'azure', 'private'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition ${
                    activeTab === tab
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* AWS Form */}
            {activeTab === 'aws' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Connection Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Production AWS Account"
                    value={awsForm.name}
                    onChange={(e) => setAwsForm({ ...awsForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Access Key ID</label>
                    <input
                      type="text"
                      placeholder="AKIA..."
                      value={awsForm.aws_access_key_id}
                      onChange={(e) => setAwsForm({ ...awsForm, aws_access_key_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Secret Access Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={awsForm.aws_secret_access_key}
                      onChange={(e) => setAwsForm({ ...awsForm, aws_secret_access_key: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Default Region</label>
                    <input
                      type="text"
                      placeholder="us-east-1"
                      value={awsForm.region}
                      onChange={(e) => setAwsForm({ ...awsForm, region: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Role ARN (Optional)</label>
                    <input
                      type="text"
                      placeholder="arn:aws:iam::123456789012:role/..."
                      value={awsForm.role_arn}
                      onChange={(e) => setAwsForm({ ...awsForm, role_arn: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* GCP Form */}
            {activeTab === 'gcp' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Connection Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Production GCP Project"
                    value={gcpForm.name}
                    onChange={(e) => setGcpForm({ ...gcpForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Project ID</label>
                  <input
                    type="text"
                    placeholder="my-gcp-project-1234"
                    value={gcpForm.project_id}
                    onChange={(e) => setGcpForm({ ...gcpForm, project_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Service Account JSON Payload</label>
                  <textarea
                    rows={4}
                    placeholder='{"type": "service_account", "project_id": "...", ...}'
                    value={gcpForm.service_account_json}
                    onChange={(e) => setGcpForm({ ...gcpForm, service_account_json: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            {/* Azure Form */}
            {activeTab === 'azure' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Connection Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Azure Enterprise Subscription"
                    value={azureForm.name}
                    onChange={(e) => setAzureForm({ ...azureForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Subscription ID</label>
                    <input
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={azureForm.subscription_id}
                      onChange={(e) => setAzureForm({ ...azureForm, subscription_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Tenant ID</label>
                    <input
                      type="text"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={azureForm.tenant_id}
                      onChange={(e) => setAzureForm({ ...azureForm, tenant_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Client ID</label>
                    <input
                      type="text"
                      placeholder="Application (client) ID"
                      value={azureForm.client_id}
                      onChange={(e) => setAzureForm({ ...azureForm, client_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Client Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={azureForm.client_secret}
                      onChange={(e) => setAzureForm({ ...azureForm, client_secret: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Private Form */}
            {activeTab === 'private' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Host Name / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Baremetal DB Server"
                    value={privateForm.name}
                    onChange={(e) => setPrivateForm({ ...privateForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Prometheus / Node Exporter Endpoint URL</label>
                  <input
                    type="text"
                    placeholder="http://192.168.1.100:9100/metrics"
                    value={privateForm.endpoint_url}
                    onChange={(e) => setPrivateForm({ ...privateForm, endpoint_url: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => createConnMutation.mutate()}
                disabled={createConnMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {createConnMutation.isPending ? 'Verifying...' : 'Save & Secure in Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
