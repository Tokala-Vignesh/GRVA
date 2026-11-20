import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { CloudResource } from '../types';
import { Activity, Cpu, HardDrive, Network, RefreshCw } from 'lucide-react';

export const MonitoringPage: React.FC = () => {
  const { data: resources, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['monitoring-resources'],
    queryFn: () => api.getResources(),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Live Infrastructure Monitoring</h2>
          <p className="text-xs text-slate-400">
            Real-time telemetry gauges across connected virtual machines and nodes.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(resources || []).map((r) => {
          const cpuVal = r.latest_cpu !== null ? r.latest_cpu : 0;
          const memVal = r.latest_mem !== null ? r.latest_mem : null;
          const diskVal = r.latest_disk !== null ? r.latest_disk : null;

          return (
            <div
              key={r.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="truncate">
                  <h3 className="font-semibold text-sm text-slate-100 truncate">{r.resource_name}</h3>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{r.provider} • {r.region}</span>
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
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                {/* CPU Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" /> CPU Utilization
                    </span>
                    <span className="font-semibold text-slate-200">
                      {r.latest_cpu !== null ? `${r.latest_cpu.toFixed(1)}%` : 'No signal'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
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
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Activity className="w-3.5 h-3.5 text-indigo-400" /> Memory
                    </span>
                    <span className="font-semibold text-slate-200">
                      {memVal !== null ? `${memVal.toFixed(1)}%` : <span className="text-[10px] text-slate-500">Agent req.</span>}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${memVal !== null ? Math.min(100, Math.max(0, memVal)) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Disk Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Storage
                    </span>
                    <span className="font-semibold text-slate-200">
                      {diskVal !== null ? `${diskVal.toFixed(1)}%` : <span className="text-[10px] text-slate-500">Agent req.</span>}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${diskVal !== null ? Math.min(100, Math.max(0, diskVal)) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {(!resources || resources.length === 0) && !isLoading && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No resources connected. Add accounts in Cloud Connections.
          </div>
        )}
      </div>
    </div>
  );
};
