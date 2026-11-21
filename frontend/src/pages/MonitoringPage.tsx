import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ProviderLogo } from '../components/ProviderLogos';
import { CloudResource, CloudProvider } from '../types';
import {
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  ExternalLink,
  Layers,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type CloudCategory = 'all' | 'hyperscale' | 'vps' | 'paas' | 'containers';

const CATEGORY_MAP: Record<CloudCategory, { label: string; providers: CloudProvider[] }> = {
  all: {
    label: 'All Clouds (14)',
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

export const MonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<CloudCategory>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [thresholdFilter, setThresholdFilter] = useState<'all' | 'high_cpu' | 'high_mem' | 'degraded'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'none' | 'provider' | 'status'>('provider');

  const { data: resources, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['monitoring-resources'],
    queryFn: () => api.getResources(),
    refetchInterval: 10000,
  });

  const filteredResources = (resources || []).filter((r) => {
    if (selectedCategory !== 'all') {
      const allowed = CATEGORY_MAP[selectedCategory].providers;
      if (!allowed.includes(r.provider as CloudProvider)) return false;
    }
    if (selectedProvider !== 'all' && r.provider !== selectedProvider) {
      return false;
    }
    if (thresholdFilter === 'high_cpu' && (r.latest_cpu === null || r.latest_cpu < 70)) {
      return false;
    }
    if (thresholdFilter === 'high_mem' && (r.latest_mem === null || r.latest_mem < 80)) {
      return false;
    }
    if (thresholdFilter === 'degraded' && r.status === 'running') {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matches =
        r.resource_name.toLowerCase().includes(term) ||
        r.resource_id.toLowerCase().includes(term) ||
        r.provider.toLowerCase().includes(term) ||
        r.region.toLowerCase().includes(term);
      if (!matches) return false;
    }
    return true;
  });

  // Grouping logic
  const groupedResources: Record<string, CloudResource[]> = {};
  if (groupBy === 'provider') {
    filteredResources.forEach((r) => {
      const key = r.provider.toUpperCase();
      if (!groupedResources[key]) groupedResources[key] = [];
      groupedResources[key].push(r);
    });
  } else if (groupBy === 'status') {
    filteredResources.forEach((r) => {
      const key = r.status.toUpperCase();
      if (!groupedResources[key]) groupedResources[key] = [];
      groupedResources[key].push(r);
    });
  } else {
    groupedResources['All Resources'] = filteredResources;
  }

  return (
    <div className="space-y-4">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Live Infrastructure Monitoring & Gauges
          </h2>
          <p className="text-xs text-slate-400">
            Real-time normalized CPU, Memory, and Disk telemetry streaming across all 14 multi-cloud connectors.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0D1424] hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-cyan-400' : ''}`} />
          Refresh
        </button>
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
            </button>
          );
        })}
      </div>

      {/* Controls Bar: Group By, Threshold Quick Filters, Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1424]/90 border border-slate-800/80 rounded-2xl p-3 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Group By selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Group:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="bg-[#090D18] border border-slate-800 rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="provider">By Cloud Provider</option>
              <option value="status">By Health Status</option>
              <option value="none">Flat Matrix</option>
            </select>
          </div>

          {/* Threshold quick pills */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setThresholdFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition ${
                thresholdFilter === 'all'
                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Levels
            </button>
            <button
              onClick={() => setThresholdFilter('high_cpu')}
              className={`px-2.5 py-1 rounded-lg transition ${
                thresholdFilter === 'high_cpu'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CPU &gt;70%
            </button>
            <button
              onClick={() => setThresholdFilter('high_mem')}
              className={`px-2.5 py-1 rounded-lg transition ${
                thresholdFilter === 'high_mem'
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RAM &gt;80%
            </button>
            <button
              onClick={() => setThresholdFilter('degraded')}
              className={`px-2.5 py-1 rounded-lg transition ${
                thresholdFilter === 'degraded'
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Degraded Only
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2" />
          <input
            type="text"
            placeholder="Search telemetry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#090D18] border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-1 text-slate-100 placeholder-slate-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* Grouped Gauge Cards */}
      <div className="space-y-6">
        {Object.entries(groupedResources).map(([groupTitle, items]) => (
          <div key={groupTitle} className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 px-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>{groupTitle}</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-normal">
                  {items.length} {items.length === 1 ? 'instance' : 'instances'}
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((r) => {
                const cpuVal = r.latest_cpu !== null ? r.latest_cpu : 0;
                const memVal = r.latest_mem !== null ? r.latest_mem : null;
                const diskVal = r.latest_disk !== null ? r.latest_disk : null;

                return (
                  <div
                    key={r.id}
                    className="bg-[#0D1424] border border-slate-800/80 hover:border-cyan-500/30 rounded-2xl p-4 shadow-sm transition space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-950 border border-slate-800 p-1 shrink-0">
                          <ProviderLogo provider={r.provider} size={15} />
                        </div>
                        <div className="truncate">
                          <h4 className="font-semibold text-sm text-slate-100 truncate">{r.resource_name}</h4>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">{r.provider} • {r.region}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'running'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${r.status === 'running' ? 'bg-emerald-400' : 'bg-rose-400'}`}
                        />
                        {r.status}
                      </span>
                    </div>

                    {/* Telemetry Gauges */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
                      {/* CPU Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Cpu className="w-3.5 h-3.5 text-cyan-400" /> CPU Utilization
                          </span>
                          <span className="font-bold text-slate-200">
                            {r.latest_cpu !== null ? `${r.latest_cpu.toFixed(1)}%` : 'No signal'}
                          </span>
                        </div>
                        <div className="w-full bg-[#090D18] rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              cpuVal > 85 ? 'bg-rose-500' : cpuVal > 65 ? 'bg-amber-500' : 'bg-cyan-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, cpuVal))}%` }}
                          />
                        </div>
                      </div>

                      {/* Memory Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Activity className="w-3.5 h-3.5 text-indigo-400" /> Memory
                          </span>
                          <span className="font-bold text-slate-200">
                            {memVal !== null ? `${memVal.toFixed(1)}%` : <span className="text-[10px] text-slate-500">Agent req.</span>}
                          </span>
                        </div>
                        <div className="w-full bg-[#090D18] rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${memVal !== null ? Math.min(100, Math.max(0, memVal)) : 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Storage Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Storage
                          </span>
                          <span className="font-bold text-slate-200">
                            {diskVal !== null ? `${diskVal.toFixed(1)}%` : <span className="text-[10px] text-slate-500">Agent req.</span>}
                          </span>
                        </div>
                        <div className="w-full bg-[#090D18] rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${diskVal !== null ? Math.min(100, Math.max(0, diskVal)) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-mono text-[10px] truncate max-w-[140px]">
                        {r.instance_type || 'virtual_machine'}
                      </span>
                      <button
                        onClick={() => navigate('/ai-intelligence')}
                        className="flex items-center gap-1 text-violet-400 hover:text-violet-300 font-medium transition"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>RCA Analysis</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredResources.length === 0 && !isLoading && (
          <div className="py-16 text-center text-slate-500 bg-[#0D1424] border border-slate-800 rounded-2xl p-6">
            No telemetry reported matching active filters.
          </div>
        )}
      </div>
    </div>
  );
};
