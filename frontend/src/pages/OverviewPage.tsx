import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
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
  Network,
  Activity,
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
  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['monitoring-overview'],
    queryFn: () => api.getOverview(),
    refetchInterval: 15000,
  });

  const { data: resources } = useQuery({
    queryKey: ['resources-list'],
    queryFn: () => api.getResources(),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Loading multi-cloud telemetry...
      </div>
    );
  }

  // Provider Distribution Data for Pie Chart
  const providerDistribution = overview?.provider_distribution || {};
  const pieData = Object.entries(providerDistribution).map(([name, value]) => ({
    name: name.toUpperCase(),
    value: value || 0,
  }));

  const COLORS = {
    AWS: '#FF9900',
    GCP: '#4285F4',
    AZURE: '#0089D6',
    PRIVATE: '#10B981',
  };

  // Real-time telemetry series from backend
  const telemetryData = overview?.telemetry_series || [];

  return (
    <div className="space-y-6">
      {/* Top Stat Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Cloud Accounts</span>
            <Cloud className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white">{overview?.total_connections ?? 0}</p>
          <span className="text-[10px] text-slate-500">Connected providers</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Resources</span>
            <Boxes className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{overview?.total_resources ?? 0}</p>
          <span className="text-[10px] text-slate-500">Tracked compute assets</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Healthy</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{overview?.healthy_resources ?? 0}</p>
          <span className="text-[10px] text-slate-500">Operating nominally</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{overview?.warning_resources ?? 0}</p>
          <span className="text-[10px] text-slate-500">Threshold alerts</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Critical</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400">{overview?.critical_resources ?? 0}</p>
          <span className="text-[10px] text-slate-500">Action required</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Incidents</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-white">{overview?.active_incidents ?? 0}</p>
          <span className="text-[10px] text-slate-500">Open investigations</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Telemetry Trend Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Aggregated Multi-Cloud CPU & Utilization Trends
              </h3>
              <p className="text-xs text-slate-400">Real-time normalized percentage usage</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> CPU %
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Memory %
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {telemetryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#475569" fontSize={11} />
                  <YAxis stroke="#475569" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} fill="url(#cpuGrad)" />
                  <Area type="monotone" dataKey="mem" stroke="#6366f1" strokeWidth={2} fill="url(#memGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg p-6 text-center">
                <Activity className="w-7 h-7 text-slate-600 mb-2 animate-pulse" />
                <p className="text-xs font-semibold text-slate-300">Awaiting Live Telemetry Stream</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  Real-time CPU and Memory trends will render here automatically as connected cloud infrastructure ingests metrics.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Provider Distribution Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Provider Distribution
            </h3>
            <p className="text-xs text-slate-400">Inventory breakdown across clouds</p>
          </div>

          <div className="h-52 flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[entry.name as keyof typeof COLORS] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">No resources discovered yet</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF9900]"></span> AWS ({providerDistribution.aws || 0})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]"></span> GCP ({providerDistribution.gcp || 0})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0089D6]"></span> Azure ({providerDistribution.azure || 0})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span> Private ({providerDistribution.private || 0})
            </span>
          </div>
        </div>
      </div>

      {/* Recent Discovered Resources Table Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Live Resource Health Status</h3>
            <p className="text-xs text-slate-400">Current compute assets reported by provider connectors</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
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
                <tr key={r.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-100">{r.resource_name}</td>
                  <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-400">{r.provider}</td>
                  <td className="py-2.5 px-3">{r.region}</td>
                  <td className="py-2.5 px-3 text-slate-400">{r.instance_type || 'virtual_machine'}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        r.status === 'running'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {r.latest_cpu !== null ? `${r.latest_cpu.toFixed(1)}%` : <span className="text-slate-500">-</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    {r.latest_mem !== null ? `${r.latest_mem.toFixed(1)}%` : <span className="text-slate-500">Agent req.</span>}
                  </td>
                </tr>
              ))}
              {(!resources || resources.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500">
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
