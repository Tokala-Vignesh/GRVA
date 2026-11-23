import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { CloudConnection, CloudProvider } from '../types';
import { ProviderLogo } from '../components/ProviderLogos';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Lock,
  ExternalLink,
  Search,
  Info,
  ShieldCheck,
  ChevronRight,
  X,
  Zap,
  HelpCircle,
} from 'lucide-react';

type ProviderCategory = 'all' | 'hyperscale' | 'vps' | 'paas' | 'containers';

interface PlatformMeta {
  id: CloudProvider;
  name: string;
  category: 'hyperscale' | 'vps' | 'paas' | 'containers';
  categoryLabel: string;
  tag: string;
  tagColor: string;
  description: string;
  configHint: string;
  docUrl: string;
}

const PLATFORMS: PlatformMeta[] = [
  // 1. Hyperscale
  {
    id: 'aws',
    name: 'Amazon Web Services',
    category: 'hyperscale',
    categoryLabel: 'Hyperscale Cloud',
    tag: 'Free Tier Available',
    tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    description: 'EC2 instances, CloudWatch metrics, S3, and Cost Explorer.',
    configHint: 'Generate an IAM Access Key & Secret in AWS Console -> IAM -> Users -> Security Credentials. Requires ReadOnlyAccess or CloudWatchReadOnlyAccess.',
    docUrl: 'https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html',
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    category: 'hyperscale',
    categoryLabel: 'Hyperscale Cloud',
    tag: '1M Free Read Calls/Mo',
    tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Compute Engine, Cloud Operations Suite, and Cloud Logging.',
    configHint: 'Create a Service Account in GCP Console -> IAM & Admin -> Service Accounts with "Monitoring Viewer" and "Compute Viewer" roles, then export the JSON key.',
    docUrl: 'https://cloud.google.com/iam/docs/creating-managing-service-account-keys',
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    category: 'hyperscale',
    categoryLabel: 'Hyperscale Cloud',
    tag: 'Enterprise & Free Tier',
    tagColor: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    description: 'Azure VMs, Azure Monitor Metrics, and Resource Groups.',
    configHint: 'Register an App in Microsoft Entra ID (Azure AD), generate a Client Secret, and assign the "Reader" role on your Subscription.',
    docUrl: 'https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal',
  },
  {
    id: 'oci',
    name: 'Oracle Cloud (OCI)',
    category: 'hyperscale',
    categoryLabel: 'Hyperscale Cloud',
    tag: 'Most Generous Always-Free',
    tagColor: 'bg-red-500/10 text-red-400 border-red-500/20',
    description: 'Always-Free ARM Ampere (4 cores/24GB RAM) & AMD micro VMs with free Telemetry.',
    configHint: 'Copy your Tenancy OCID from OCI Console -> Profile -> Tenancy (format: ocid1.tenancy.oc1..[id]). The Telemetry Monitoring API is 100% free.',
    docUrl: 'https://docs.oracle.com/en-us/iaas/Content/General/Concepts/identifiers.htm',
  },

  // 2. Developer & VPS
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    category: 'vps',
    categoryLabel: 'Developer & VPS',
    tag: '100% Free Monitoring API',
    tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Droplets, App Platform, and free 1-minute do-agent CPU/Memory metrics.',
    configHint: 'Generate a Personal Access Token in DigitalOcean Dashboard -> API -> Generate New Token with "Read" scope.',
    docUrl: 'https://docs.digitalocean.com/reference/api/api-reference/#section/Authentication',
  },
  {
    id: 'hetzner',
    name: 'Hetzner Cloud',
    category: 'vps',
    categoryLabel: 'Developer & VPS',
    tag: 'Free REST API',
    tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    description: 'High-performance cloud servers, live status, and CPU time-series metrics.',
    configHint: 'In Hetzner Cloud Console -> Select Project -> Security -> API Tokens -> Generate API Token with "Read" permissions.',
    docUrl: 'https://docs.hetzner.cloud/#getting-started',
  },

  // 3. PaaS & Serverless
  {
    id: 'render',
    name: 'Render',
    category: 'paas',
    categoryLabel: 'PaaS & Serverless',
    tag: 'Free Web Services',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Free tier web services, static sites, background workers, and PostgreSQL.',
    configHint: 'Generate an API Key in Render Dashboard -> Account Settings -> API Keys -> Create API Key.',
    docUrl: 'https://render.com/docs/api',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'paas',
    categoryLabel: 'PaaS & Serverless',
    tag: '100,000 Free Req/Day',
    tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    description: 'Edge Worker scripts, Pages projects, request volume, and execution CPU time.',
    configHint: 'Requires your Account ID (from dashboard sidebar) and an API Token with "Account.Workers Scripts: Read" and "Account.Analytics: Read" permissions.',
    docUrl: 'https://developers.cloudflare.com/fundamentals/api/get-started/create-token/',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'paas',
    categoryLabel: 'PaaS & Serverless',
    tag: 'Free Hobby Tier',
    tagColor: 'bg-slate-200/20 text-slate-200 border-slate-700',
    description: 'Frontend Next.js/React apps, deployment preview statuses, and serverless functions.',
    configHint: 'Generate a Personal Access Token in Vercel Dashboard -> Account Settings -> Tokens -> Create.',
    docUrl: 'https://vercel.com/docs/rest-api#creating-an-api-token',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'paas',
    categoryLabel: 'PaaS & Serverless',
    tag: '2 Free Postgres DBs',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Managed PostgreSQL database health, edge functions, and project status.',
    configHint: 'Generate an Access Token in Supabase Dashboard -> Account -> Access Tokens -> Generate New Token.',
    docUrl: 'https://supabase.com/docs/reference/api/introduction',
  },
  {
    id: 'flyio',
    name: 'Fly.io',
    category: 'paas',
    categoryLabel: 'PaaS & Serverless',
    tag: 'MicroVM Architecture',
    tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    description: 'Global Firecracker microVMs, app health, and machine states.',
    configHint: 'Generate an auth token via flyctl (`fly auth token`) or via your Fly.io user account settings.',
    docUrl: 'https://fly.io/docs/machines/api/',
  },

  // 4. Containers & Servers
  {
    id: 'docker',
    name: 'Docker Engine',
    category: 'containers',
    categoryLabel: 'Containers & Servers',
    tag: '100% Free Local/Remote',
    tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    description: 'Inspect live container CPU %, memory %, network I/O, and container health.',
    configHint: 'Default TCP endpoint: http://127.0.0.1:2375. In Docker Desktop (Windows/Mac), enable "Expose daemon on tcp://localhost:2375 without TLS" in Settings -> General.',
    docUrl: 'https://docs.docker.com/engine/api/v1.43/',
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes Cluster',
    category: 'containers',
    categoryLabel: 'Containers & Servers',
    tag: 'K3s / Minikube / EKS',
    tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Cluster Nodes, Pods health, and K8s Metrics Server utilization.',
    configHint: 'Default local server: https://127.0.0.1:6443. Provide a ServiceAccount Bearer Token or paste your kubeconfig context.',
    docUrl: 'https://kubernetes.io/docs/reference/using-api/',
  },
  {
    id: 'private',
    name: 'Linux & Bare-Metal Server',
    category: 'containers',
    categoryLabel: 'Containers & Servers',
    tag: 'Prometheus Node Exporter',
    tagColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    description: 'Scrapes standard Prometheus Node Exporter on Linux servers, homelabs, and Raspberry Pis.',
    configHint: 'Install prometheus-node-exporter on your Linux node (`sudo apt install prometheus-node-exporter`). Endpoint defaults to http://127.0.0.1:9100/metrics.',
    docUrl: 'https://prometheus.io/docs/guides/node-exporter/',
  },
];

export const ConnectionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedPlatform, setSelectedPlatform] = useState<CloudProvider>('aws');
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});

  // Unified dynamic form state
  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
    // AWS
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_session_token: '',
    role_arn: '',
    region: 'us-east-1',
    // GCP
    project_id: '',
    service_account_json: '',
    // Azure
    subscription_id: '',
    tenant_id: '',
    client_id: '',
    client_secret: '',
    // OCI
    tenancy_ocid: '',
    user_ocid: '',
    fingerprint: '',
    private_key: '',
    // Token-based providers (DO, Hetzner, Render, Supabase, Fly.io, Vercel)
    api_token: '',
    api_key: '',
    account_id: '',
    team_id: '',
    // Docker
    daemon_url: 'http://127.0.0.1:2375',
    // Kubernetes
    api_server_url: 'https://127.0.0.1:6443',
    bearer_token: '',
    namespace: 'default',
    // Linux Prometheus
    endpoint_url: 'http://127.0.0.1:9100/metrics',
    auth_token: '',
  });

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections-list'],
    queryFn: () => api.getConnections(),
  });

  const createConnMutation = useMutation({
    mutationFn: async () => {
      const p = selectedPlatform;
      if (p === 'aws') {
        return api.createAWSConnection({
          name: formData.name,
          aws_access_key_id: formData.aws_access_key_id,
          aws_secret_access_key: formData.aws_secret_access_key,
          aws_session_token: formData.aws_session_token || undefined,
          role_arn: formData.role_arn || undefined,
          region: formData.region || 'us-east-1',
        });
      }
      if (p === 'gcp') {
        return api.createGCPConnection({
          name: formData.name,
          project_id: formData.project_id,
          service_account_json: formData.service_account_json || undefined,
          region: formData.region || 'us-central1',
        });
      }
      if (p === 'azure') {
        return api.createAzureConnection({
          name: formData.name,
          subscription_id: formData.subscription_id,
          tenant_id: formData.tenant_id,
          client_id: formData.client_id,
          client_secret: formData.client_secret,
          region: formData.region || 'eastus',
        });
      }
      if (p === 'oci') {
        return api.createOCIConnection({
          name: formData.name,
          tenancy_ocid: formData.tenancy_ocid,
          user_ocid: formData.user_ocid || undefined,
          fingerprint: formData.fingerprint || undefined,
          private_key: formData.private_key || undefined,
          region: formData.region || 'us-ashburn-1',
        });
      }
      if (p === 'digitalocean') {
        return api.createDigitalOceanConnection({
          name: formData.name,
          api_token: formData.api_token,
        });
      }
      if (p === 'hetzner') {
        return api.createHetznerConnection({
          name: formData.name,
          api_token: formData.api_token,
        });
      }
      if (p === 'render') {
        return api.createRenderConnection({
          name: formData.name,
          api_key: formData.api_key || formData.api_token,
        });
      }
      if (p === 'cloudflare') {
        return api.createCloudflareConnection({
          name: formData.name,
          api_token: formData.api_token,
          account_id: formData.account_id,
        });
      }
      if (p === 'vercel') {
        return api.createVercelConnection({
          name: formData.name,
          api_token: formData.api_token,
          team_id: formData.team_id || undefined,
        });
      }
      if (p === 'supabase') {
        return api.createSupabaseConnection({
          name: formData.name,
          api_token: formData.api_token,
        });
      }
      if (p === 'flyio') {
        return api.createFlyioConnection({
          name: formData.name,
          api_token: formData.api_token,
        });
      }
      if (p === 'docker') {
        return api.createDockerConnection({
          name: formData.name,
          daemon_url: formData.daemon_url,
          tls_verify: false,
        });
      }
      if (p === 'kubernetes') {
        return api.createKubernetesConnection({
          name: formData.name,
          api_server_url: formData.api_server_url,
          bearer_token: formData.bearer_token || undefined,
          namespace: formData.namespace || 'default',
        });
      }
      if (p === 'private') {
        return api.createPrivateConnection({
          name: formData.name,
          endpoint_url: formData.endpoint_url,
          auth_token: formData.auth_token || undefined,
          region: 'on-premise',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections-list'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-overview'] });
      setShowAddModal(false);
      setFormData((prev) => ({ ...prev, name: '' }));
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
        setSyncStatus((prev) => ({ ...prev, [id]: 'Synced' }));
      }, 2000);
    },
  });

  // Filtered platforms
  const filteredPlatforms = PLATFORMS.filter((plat) => {
    const matchesCategory = selectedCategory === 'all' || plat.category === selectedCategory;
    const matchesSearch =
      plat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plat.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plat.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const currentPlatformMeta = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            Multi-Cloud & Infrastructure Connections
          </h2>
          <p className="text-xs text-slate-400">
            Connect and track your Hyperscale Clouds, VPS hosts, Developer PaaS, Docker containers, and Kubernetes clusters.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Cloud Connection
        </button>
      </div>

      {/* Security Vault Assurance Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-200">Zero-Cloud-Leak Vault Security</span>
            <p className="text-[11px] text-slate-400">
              API tokens and credentials are encrypted strictly inside your native OS Keyring / AES-256 vault. They never leave your local machine.
            </p>
          </div>
        </div>
        <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5" />
          LOCAL VAULT ENCRYPTED
        </span>
      </div>

      {/* Active Connections List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Active Connected Platforms ({connections?.length || 0})
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading registered connections...</div>
        ) : connections && connections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {connections.map((conn) => {
              const meta = PLATFORMS.find((p) => p.id === conn.provider) || {
                name: conn.provider.toUpperCase(),
                categoryLabel: 'Infrastructure',
                tag: 'Connected',
                tagColor: 'bg-slate-800 text-slate-300',
              };

              return (
                <div
                  key={conn.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                          <ProviderLogo provider={conn.provider} size={22} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-100 text-xs">{conn.name}</h4>
                          <span className="text-[10px] text-slate-400">{meta.name}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 border ${
                          conn.status === 'connected'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {conn.status === 'connected' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {conn.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <div className="truncate">
                        <span className="text-slate-500">ID / Target: </span>
                        <span className="text-slate-200">{conn.account_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Region: </span>
                        <span className="text-slate-300">{conn.region || 'global'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Test Result Drawer */}
                  {testResult[conn.id] && (
                    <div
                      className={`p-2 rounded text-[10px] font-mono border ${
                        testResult[conn.id].status === 'success'
                          ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
                      }`}
                    >
                      {testResult[conn.id].status === 'success'
                        ? '✓ Connection verified successfully'
                        : `✗ ${testResult[conn.id].error || 'Validation failed'}`}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => testConnMutation.mutate(conn.id)}
                        disabled={testConnMutation.isPending}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => syncConnMutation.mutate(conn.id)}
                        disabled={syncConnMutation.isPending}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncStatus[conn.id] === 'Syncing...' ? 'animate-spin' : ''}`} />
                        {syncStatus[conn.id] || 'Sync'}
                      </button>
                    </div>

                    <button
                      onClick={() => deleteConnMutation.mutate(conn.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                      title="Delete connection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-cyan-400">
              <Server className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">No Active Cloud Connections</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add your Oracle Cloud Always-Free tier, DigitalOcean, Hetzner, Docker daemon, or AWS/GCP/Azure credentials to begin monitoring your infrastructure.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition"
            >
              Add Your First Connection
            </button>
          </div>
        )}
      </div>

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  Connect Cloud Platform or Infrastructure
                </h3>
                <p className="text-xs text-slate-400">
                  Select a platform below to configure credentials.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-2">
                {[
                  { id: 'all', label: 'All Platforms' },
                  { id: 'hyperscale', label: 'Hyperscale Cloud' },
                  { id: 'vps', label: 'Developer & VPS' },
                  { id: 'paas', label: 'PaaS & Serverless' },
                  { id: 'containers', label: 'Containers & Servers' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as ProviderCategory)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Provider Grid Selection */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                {filteredPlatforms.map((plat) => {
                  const isSelected = selectedPlatform === plat.id;
                  return (
                    <button
                      key={plat.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(plat.id);
                        if (!formData.name) setFormData((prev) => ({ ...prev, name: plat.name }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-500 shadow-sm shadow-cyan-900/30'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <ProviderLogo provider={plat.id} size={20} />
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${plat.tagColor}`}>
                          {plat.categoryLabel.split(' ')[0]}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-slate-200 block truncate">{plat.name}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{plat.tag}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Provider Configuration Form */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <ProviderLogo provider={currentPlatformMeta.id} size={24} />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-100">{currentPlatformMeta.name}</h4>
                    <span className="text-[10px] text-slate-400">{currentPlatformMeta.description}</span>
                  </div>
                </div>
                <a
                  href={currentPlatformMeta.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  Docs
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Helpful Configuration Hint / Tooltip Box */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-2.5 leading-relaxed">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5 text-cyan-300">How to get credentials:</span>
                  <p className="text-[11px] text-cyan-100/90">{currentPlatformMeta.configHint}</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Connection Display Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={`e.g. Production ${currentPlatformMeta.name}`}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                  />
                </div>

                {/* AWS Specific */}
                {selectedPlatform === 'aws' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">AWS Access Key ID</label>
                        <input
                          type="text"
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          value={formData.aws_access_key_id}
                          onChange={(e) => setFormData({ ...formData, aws_access_key_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">AWS Secret Access Key</label>
                        <input
                          type="password"
                          placeholder="••••••••••••••••••••"
                          value={formData.aws_secret_access_key}
                          onChange={(e) => setFormData({ ...formData, aws_secret_access_key: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Region</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        placeholder="us-east-1"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* GCP Specific */}
                {selectedPlatform === 'gcp' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">GCP Project ID</label>
                      <input
                        type="text"
                        placeholder="my-gcp-project-12345"
                        value={formData.project_id}
                        onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Service Account JSON Content</label>
                      <textarea
                        rows={3}
                        placeholder='{"type": "service_account", "project_id": ...}'
                        value={formData.service_account_json}
                        onChange={(e) => setFormData({ ...formData, service_account_json: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* Azure Specific */}
                {selectedPlatform === 'azure' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Subscription ID</label>
                        <input
                          type="text"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={formData.subscription_id}
                          onChange={(e) => setFormData({ ...formData, subscription_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Tenant ID</label>
                        <input
                          type="text"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={formData.tenant_id}
                          onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Client (App) ID</label>
                        <input
                          type="text"
                          value={formData.client_id}
                          onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Client Secret</label>
                        <input
                          type="password"
                          value={formData.client_secret}
                          onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Oracle Cloud OCI Specific */}
                {selectedPlatform === 'oci' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Tenancy OCID (Always-Free Root)</label>
                      <input
                        type="text"
                        placeholder="ocid1.tenancy.oc1..aaaaaaaaxxxxxxxxxxxxxxxxx"
                        value={formData.tenancy_ocid}
                        onChange={(e) => setFormData({ ...formData, tenancy_ocid: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Region</label>
                        <input
                          type="text"
                          placeholder="us-ashburn-1, eu-frankfurt-1"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">User OCID (Optional for API Key)</label>
                        <input
                          type="text"
                          placeholder="ocid1.user.oc1..aaaaaaaaxxxxx"
                          value={formData.user_ocid}
                          onChange={(e) => setFormData({ ...formData, user_ocid: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* DigitalOcean / Hetzner / Supabase / Fly.io / Vercel Specific (Single Token) */}
                {['digitalocean', 'hetzner', 'supabase', 'flyio', 'vercel'].includes(selectedPlatform) && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Personal Access Token / API Token</label>
                      <input
                        type="password"
                        placeholder="Bearer token or API key"
                        value={formData.api_token}
                        onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* Render Specific */}
                {selectedPlatform === 'render' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Render API Key</label>
                      <input
                        type="password"
                        placeholder="rnd_xxxxxxxxxxxxxxxxxxxxxxxx"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* Cloudflare Specific */}
                {selectedPlatform === 'cloudflare' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Cloudflare Account ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                        value={formData.account_id}
                        onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Cloudflare API Token</label>
                      <input
                        type="password"
                        placeholder="API Token with Workers & Analytics Read permissions"
                        value={formData.api_token}
                        onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* Docker Specific */}
                {selectedPlatform === 'docker' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Docker Daemon URL / Socket</label>
                      <input
                        type="text"
                        value={formData.daemon_url}
                        onChange={(e) => setFormData({ ...formData, daemon_url: e.target.value })}
                        placeholder="http://127.0.0.1:2375"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Windows/Mac TCP: http://127.0.0.1:2375 • Linux Socket: http://localhost:2375
                      </span>
                    </div>
                  </div>
                )}

                {/* Kubernetes Specific */}
                {selectedPlatform === 'kubernetes' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Kubernetes API Server URL</label>
                      <input
                        type="text"
                        value={formData.api_server_url}
                        onChange={(e) => setFormData({ ...formData, api_server_url: e.target.value })}
                        placeholder="https://127.0.0.1:6443"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Bearer Token (ServiceAccount)</label>
                        <input
                          type="password"
                          placeholder="Optional for local development clusters"
                          value={formData.bearer_token}
                          onChange={(e) => setFormData({ ...formData, bearer_token: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Namespace</label>
                        <input
                          type="text"
                          value={formData.namespace}
                          onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                          placeholder="default"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Linux / Bare-Metal Server (Prometheus Node Exporter) */}
                {selectedPlatform === 'private' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Prometheus Node Exporter URL</label>
                      <input
                        type="text"
                        value={formData.endpoint_url}
                        onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                        placeholder="http://192.168.1.100:9100/metrics"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Bearer Auth Token (Optional)</label>
                      <input
                        type="password"
                        value={formData.auth_token}
                        onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })}
                        placeholder="Optional HTTP bearer token if protected"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createConnMutation.mutate()}
                  disabled={createConnMutation.isPending || !formData.name.trim()}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {createConnMutation.isPending ? 'Verifying...' : 'Save & Connect Platform'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
