import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ProviderLogo } from '../components/ProviderLogos';
import {
  Boxes,
  Cloud,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Server,
  TrendingUp,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: overview, isLoading } = useQuery({
    queryKey: ['monitoring-overview'],
    queryFn: () => api.getOverview(),
    refetchInterval: 15000,
  });

  const { data: resources } = useQuery({
    queryKey: ['resources-list'],
    queryFn: () => api.getResources(),
    refetchInterval: 15000,
  });

  const providerDistribution = overview?.provider_distribution || {};
  const pieData = Object.entries(providerDistribution)
    .filter(([_, value]) => (value as number) > 0)
    .map(([name, value]) => ({
      name: name.toUpperCase(),
      value: value as number,
    }));

  const COLORS: Record<string, string> = {
    AWS: '#FF9900',
    GCP: '#4285F4',
    AZURE: '#0089D6',
    OCI: '#C74634',
    DIGITALOCEAN: '#0080FF',
    HETZNER: '#D50C2D',
    RENDER: '#46E3B7',
    CLOUDFLARE: '#F38020',
    VERCEL: '#E2E8F0',
    SUPABASE: '#3ECF8E',
    FLYIO: '#7B39ED',
    DOCKER: '#2496ED',
    KUBERNETES: '#326CE5',
    PRIVATE: '#10B981',
  };

  const telemetryData = overview?.telemetry_series || [];

  const totalResources = overview?.total_resources ?? 0;
  const healthyResources = overview?.healthy_resources ?? 0;
  const healthPercent = totalResources > 0 ? Math.round((healthyResources / totalResources) * 100) : 100;

  return (
    <div className="space-y-5">
      {/* Top Hero KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Compute Assets */}
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Tracked Resources</span>
            <Boxes className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{totalResources}</p>
          <span className="text-[10px] text-slate-500 font-medium">Across 14 multi-cloud connectors</span>
        </div>

        {/* Global Health SLA */}
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Fleet Health Ratio</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 tracking-tight">{healthPercent}%</p>
          <span className="text-[10px] text-slate-500 font-medium">
            {healthyResources} of {totalResources} operating nominally
          </span>
        </div>

        {/* Active Incidents */}
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Incidents</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 tracking-tight">{overview?.active_incidents ?? 0}</p>
          <span className="text-[10px] text-slate-500 font-medium">AI investigations active</span>
        </div>

        {/* Connected Cloud Accounts */}
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Cloud Connections</span>
            <Cloud className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-violet-400 tracking-tight">{overview?.total_connections ?? 0}</p>
          <span className="text-[10px] text-slate-500 font-medium">Encrypted with OS Keyring</span>
        </div>
      </div>

      {/* Main Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Real-time Telemetry Trend Chart (2 columns) */}
        <div className="lg:col-span-2 bg-[#0D1424] border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Aggregated Multi-Cloud CPU & Memory Telemetry
              </h3>
              <p className="text-xs text-slate-400">Real-time normalized percentage load across all connected nodes</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> CPU %
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Memory %
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-1">
            {telemetryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#475569" fontSize={10} />
                  <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090D18',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} fill="url(#cpuGrad)" />
                  <Area type="monotone" dataKey="mem" stroke="#6366f1" strokeWidth={2} fill="url(#memGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-xl p-6 text-center">
                <Activity className="w-7 h-7 text-slate-600 mb-2 animate-pulse" />
                <p className="text-xs font-semibold text-slate-300">Awaiting Live Telemetry Stream</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  Connect cloud credentials in Cloud Connections to begin streaming live CPU and Memory trends.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Cloud Provider Distribution (1 column) */}
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-violet-400" />
              Platform Inventory Breakdown
            </h3>
            <p className="text-xs text-slate-400">Distribution across 14 supported clouds</p>
          </div>

          <div className="h-44 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[entry.name] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090D18',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 text-center">
                Zero discovered assets yet.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-3 max-h-28 overflow-y-auto">
            {pieData.length > 0 ? (
              pieData.map((item) => (
                <span key={item.name} className="flex items-center gap-1.5 text-slate-300 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[item.name] || '#94a3b8' }}
                  />
                  <span className="uppercase text-[11px] truncate font-medium">{item.name}</span>
                  <span className="text-slate-500 font-mono">({item.value})</span>
                </span>
              ))
            ) : (
              <div className="col-span-2 text-center text-slate-500 text-[11px] py-1">
                Supported across 14 clouds
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Discovered Compute Assets Preview Table */}
      <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Live Compute Assets (Preview)</h3>
            <p className="text-xs text-slate-400">Current compute assets reported by provider connectors</p>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition"
          >
            <span>View Full Inventory (14 Clouds)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#090D18] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Resource Name</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Region</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">CPU %</th>
                <th className="py-2.5 px-3">Memory %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(resources || []).slice(0, 5).map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-100">{r.resource_name}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded flex items-center justify-center bg-slate-950 border border-slate-800 p-0.5 shrink-0">
                        <ProviderLogo provider={r.provider} size={11} />
                      </div>
                      <span className="font-semibold text-[10px] text-slate-300 uppercase">
                        {r.provider}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{r.region}</td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{r.instance_type || 'virtual_machine'}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.status === 'running'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'running' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">
                    {r.latest_cpu !== null ? `${r.latest_cpu.toFixed(1)}%` : <span className="text-slate-500">-</span>}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">
                    {r.latest_mem !== null ? `${r.latest_mem.toFixed(1)}%` : <span className="text-slate-500">-</span>}
                  </td>
                </tr>
              ))}
              {(!resources || resources.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No resources connected yet. Navigate to Cloud Connections to configure accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
