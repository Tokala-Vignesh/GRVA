import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { LineChart, Download, Sparkles, AlertCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export const MetricsExplorerPage: React.FC = () => {
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('cpu_usage_percent');

  const { data: resources } = useQuery({
    queryKey: ['explorer-resources'],
    queryFn: () => api.getResources(),
  });

  // Default to first resource once loaded
  const currentResourceId = selectedResourceId || (resources && resources.length > 0 ? resources[0].id : '');

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['resource-metrics', currentResourceId],
    queryFn: () => (currentResourceId ? api.getResourceMetrics(currentResourceId, 100) : Promise.resolve([])),
    enabled: !!currentResourceId,
    refetchInterval: 15000,
  });

  const { data: forecast } = useQuery({
    queryKey: ['resource-forecast', currentResourceId, selectedMetric],
    queryFn: () => (currentResourceId ? api.getResourceForecast(currentResourceId, selectedMetric) : Promise.resolve(null)),
    enabled: !!currentResourceId,
  });

  // Format data for chart
  const chartData = (metrics || []).map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    value: m[selectedMetric as keyof typeof m] as number | null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Metrics Explorer & Analytics</h2>
          <p className="text-xs text-slate-400">
            High-resolution multi-metric time-series visualizer with forecasting analysis.
          </p>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm text-xs">
        {/* Resource Selector */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
          <span className="text-slate-500 text-[11px]">Resource:</span>
          <select
            value={currentResourceId}
            onChange={(e) => setSelectedResourceId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
          >
            {(resources || []).map((r) => (
              <option key={r.id} value={r.id}>
                [{r.provider.toUpperCase()}] {r.resource_name} ({r.resource_id})
              </option>
            ))}
          </select>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center gap-1.5 min-w-[200px]">
          <span className="text-slate-500 text-[11px]">Metric:</span>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-cyan-500"
          >
            <option value="cpu_usage_percent">CPU Utilization (%)</option>
            <option value="memory_usage_percent">Memory Utilization (%)</option>
            <option value="disk_usage_percent">Disk Storage (%)</option>
            <option value="network_in_bytes">Network In (Bytes)</option>
            <option value="network_out_bytes">Network Out (Bytes)</option>
          </select>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-cyan-400" />
            Time-Series Telemetry
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {chartData.length} observations
          </span>
        </div>

        <div className="h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={selectedMetric}
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#metricGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              No telemetry collected yet for this resource. Wait for the collector or run sync.
            </div>
          )}
        </div>
      </div>

      {/* Predictive Analytics Banner */}
      {forecast && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm mb-2">
            <Sparkles className="w-4 h-4" />
            <h3>Predictive Machine Learning Forecasting</h3>
          </div>

          {forecast.status === 'forecasted' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block mb-1">Trend Direction</span>
                <span className="font-bold text-slate-100 uppercase">{forecast.trend_direction}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block mb-1">Hourly Rate of Change</span>
                <span className="font-bold text-slate-100">{forecast.hourly_rate_of_change}% / hr</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block mb-1">Estimated Exhaustion</span>
                <span className="font-bold text-slate-100">
                  {forecast.exhaustion_threshold_hours ? `~${forecast.exhaustion_threshold_hours} hours` : 'None projected'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{forecast.message}</p>
          )}
        </div>
      )}
    </div>
  );
};
