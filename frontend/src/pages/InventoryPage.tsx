import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ProviderLogo } from '../components/ProviderLogos';
import { CloudResource, CloudProvider } from '../types';
import {
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  Cpu,
  Activity,
  HardDrive,
  Globe,
  X,
  ExternalLink,
  Sparkles,
  Layers,
  Server,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

type CloudCategory = 'all' | 'hyperscale' | 'vps' | 'paas' | 'containers';

const CATEGORY_MAP: Record<CloudCategory, { label: string; providers: CloudProvider[] }> = {
  all: {
    label: 'All Platforms (14)',
    providers: [
      'aws', 'gcp', 'azure', 'oci',
      'digitalocean', 'hetzner', 'render', 'cloudflare',
      'vercel', 'supabase', 'flyio', 'docker', 'kubernetes', 'private',
    ],
  },
  hyperscale: {
    label: 'Hyperscale Cloud',
    providers: ['aws', 'gcp', 'azure', 'oci'],
  },
  vps: {
    label: 'Developer & VPS',
    providers: ['digitalocean', 'hetzner'],
  },
  paas: {
    label: 'PaaS & Serverless',
    providers: ['render', 'cloudflare', 'vercel', 'supabase', 'flyio'],
  },
  containers: {
    label: 'Containers & Bare-Metal',
    providers: ['docker', 'kubernetes', 'private'],
  },
};

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<CloudCategory>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [inspectResource, setInspectResource] = useState<CloudResource | null>(null);

  const { data: resources, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['resources-inventory'],
    queryFn: () => api.getResources(),
    refetchInterval: 15000,
  });

  // Filter pipeline
  const filteredResources = (resources || []).filter((r) => {
    // 1. Category filter
    if (selectedCategory !== 'all') {
      const allowed = CATEGORY_MAP[selectedCategory].providers;
      if (!allowed.includes(r.provider as CloudProvider)) return false;
    }

    // 2. Provider filter
    if (selectedProvider !== 'all' && r.provider !== selectedProvider) {
      return false;
    }

    // 3. Status filter
    if (statusFilter !== 'all' && r.status !== statusFilter) {
      return false;
    }

    // 4. Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matches =
        r.resource_name.toLowerCase().includes(term) ||
        r.resource_id.toLowerCase().includes(term) ||
        r.region.toLowerCase().includes(term) ||
        (r.ip_address && r.ip_address.includes(term)) ||
        r.provider.toLowerCase().includes(term);
      if (!matches) return false;
    }

    return true;
  });

  // Compute counts per category
  const categoryCounts = {
    all: resources?.length || 0,
    hyperscale: (resources || []).filter((r) => CATEGORY_MAP.hyperscale.providers.includes(r.provider as CloudProvider)).length,
    vps: (resources || []).filter((r) => CATEGORY_MAP.vps.providers.includes(r.provider as CloudProvider)).length,
    paas: (resources || []).filter((r) => CATEGORY_MAP.paas.providers.includes(r.provider as CloudProvider)).length,
    containers: (resources || []).filter((r) => CATEGORY_MAP.containers.providers.includes(r.provider as CloudProvider)).length,
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            Multi-Cloud Resource Inventory
          </h2>
          <p className="text-xs text-slate-400">
            Real multi-cloud compute, container runtimes, and serverless assets across 14 connected providers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-[#0D1424] border border-slate-800 text-slate-400">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'hover:text-slate-200'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0D1424] hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Category Segmented Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#090D18] border border-slate-800/80 rounded-2xl overflow-x-auto text-xs">
        {(Object.keys(CATEGORY_MAP) as CloudCategory[]).map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedProvider('all');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium transition shrink-0 ${
                isSelected
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>{CATEGORY_MAP[cat].label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-cyan-800 text-cyan-100' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {categoryCounts[cat]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Provider Pill Bar & Search Bar */}
      <div className="bg-[#0D1424]/90 border border-slate-800/80 rounded-2xl p-3.5 space-y-3 shadow-sm">
        {/* Horizontal Provider Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedProvider('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition shrink-0 ${
              selectedProvider === 'all'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60'
                : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            All in Category
          </button>

          {CATEGORY_MAP[selectedCategory].providers.map((p) => {
            const isSelected = selectedProvider === p;
            const count = (resources || []).filter((r) => r.provider === p).length;

            return (
              <button
                key={p}
                onClick={() => setSelectedProvider(isSelected ? 'all' : p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition shrink-0 uppercase text-[11px] ${
                  isSelected
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <ProviderLogo provider={p} size={13} />
                <span>{p}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800/80 text-slate-400 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search and Status Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, ID, region, or IP (e.g. docker, us-east-1, i-0a8...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#090D18] border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Health Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#090D18] border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All States</option>
              <option value="running">Running / Healthy</option>
              <option value="warning">Warning / Degraded</option>
              <option value="critical">Critical / Failed</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {viewMode === 'table' ? (
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#090D18] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Resource Name</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Region / Zone</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4">CPU %</th>
                  <th className="py-3 px-4">Memory %</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredResources.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setInspectResource(r)}
                    className="hover:bg-slate-800/40 cursor-pointer transition group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                        {r.resource_name}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">{r.resource_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-950 border border-slate-800 p-0.5 shrink-0">
                          <ProviderLogo provider={r.provider} size={13} />
                        </div>
                        <span className="font-bold text-[11px] text-slate-200 uppercase">
                          {r.provider}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div>{r.region}</div>
                      {r.zone && <div className="text-[10px] text-slate-500">{r.zone}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {r.instance_type || r.resource_type || 'compute'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {r.ip_address || r.private_ip || 'Private/Internal'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'running'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : r.status === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            r.status === 'running' ? 'bg-emerald-400' : r.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                        />
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {r.latest_cpu !== null ? (
                        <span className="font-semibold text-slate-200">{r.latest_cpu.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-500 font-mono">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.latest_mem !== null ? (
                        <span className="font-semibold text-slate-200">{r.latest_mem.toFixed(1)}%</span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectResource(r);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-cyan-600/20 hover:border-cyan-500/30 border border-slate-700/60 text-[10px] transition"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredResources.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No resources found matching the selected category and filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((r) => (
            <div
              key={r.id}
              onClick={() => setInspectResource(r)}
              className="bg-[#0D1424] border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-4 shadow-sm transition cursor-pointer space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-950 border border-slate-800 p-1 shrink-0">
                    <ProviderLogo provider={r.provider} size={16} />
                  </div>
                  <div className="truncate">
                    <h4 className="font-semibold text-sm text-slate-100 truncate">{r.resource_name}</h4>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{r.provider} • {r.region}</span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    r.status === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {r.status}
                </span>
              </div>

              {/* Gauges */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/60">
                <div className="bg-[#090D18] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">CPU Load</span>
                  <span className="font-bold text-slate-100">
                    {r.latest_cpu !== null ? `${r.latest_cpu.toFixed(1)}%` : 'No signal'}
                  </span>
                </div>
                <div className="bg-[#090D18] p-2 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Memory</span>
                  <span className="font-bold text-slate-100">
                    {r.latest_mem !== null ? `${r.latest_mem.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span className="font-mono text-[10px] truncate">{r.ip_address || 'Private Node'}</span>
                <span className="text-cyan-400 font-medium text-[10px] flex items-center gap-1">
                  Inspect <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-out Resource Detail Drawer */}
      {inspectResource && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#090D18] border-l border-slate-800 h-full p-6 overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1.5">
                  <ProviderLogo provider={inspectResource.provider} size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">{inspectResource.resource_name}</h3>
                  <span className="text-xs font-mono text-slate-500 uppercase">{inspectResource.provider} • {inspectResource.region}</span>
                </div>
              </div>

              <button
                onClick={() => setInspectResource(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status Pill */}
            <div className="p-3.5 rounded-2xl bg-[#0D1424] border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Operational Status</span>
                <span className="font-bold text-sm text-slate-100 capitalize">{inspectResource.status}</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  inspectResource.status === 'running'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {inspectResource.status}
              </span>
            </div>

            {/* Specifications Grid */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Specifications</h4>
              <div className="bg-[#0D1424] rounded-2xl border border-slate-800 p-3 space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Resource ID:</span>
                  <span className="font-mono text-slate-200">{inspectResource.resource_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Instance / Container Type:</span>
                  <span className="font-mono text-slate-200">{inspectResource.instance_type || inspectResource.resource_type || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Public IP:</span>
                  <span className="font-mono text-slate-200">{inspectResource.ip_address || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Private IP:</span>
                  <span className="font-mono text-slate-200">{inspectResource.private_ip || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Availability Zone:</span>
                  <span className="text-slate-200">{inspectResource.zone || inspectResource.region}</span>
                </div>
              </div>
            </div>

            {/* Live Metrics Highlight */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Current Telemetry</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0D1424] p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CPU Load</span>
                  </div>
                  <span className="text-lg font-bold text-white">
                    {inspectResource.latest_cpu !== null ? `${inspectResource.latest_cpu.toFixed(1)}%` : 'No Signal'}
                  </span>
                </div>
                <div className="bg-[#0D1424] p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Memory</span>
                  </div>
                  <span className="text-lg font-bold text-white">
                    {inspectResource.latest_mem !== null ? `${inspectResource.latest_mem.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar: Direct AI Investigation & Metrics */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <button
                onClick={() => {
                  navigate('/ai-intelligence');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-950/50 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch Multi-Agent RCA Investigation</span>
              </button>

              <button
                onClick={() => {
                  navigate('/metrics-explorer');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-xs border border-slate-800 transition"
              >
                <span>View Full Time-Series Telemetry</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
