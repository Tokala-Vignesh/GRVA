import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Incident } from '../types';
import { ProviderLogo } from '../components/ProviderLogos';
import {
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Search,
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
  Wrench,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incidents-list'],
    queryFn: () => api.getIncidents(),
    refetchInterval: 10000,
  });

  const { data: remediations } = useQuery({
    queryKey: ['remediation-actions'],
    queryFn: () => api.getRemediationActions(),
    refetchInterval: 10000,
  });

  const investigateMutation = useMutation({
    mutationFn: (id: string) => api.investigateIncident(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
      queryClient.invalidateQueries({ queryKey: ['remediation-actions'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (actionId: string) => api.approveRemediation(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-actions'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-list'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (actionId: string) => api.rejectRemediation(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation-actions'] });
    },
  });

  const filteredIncidents = (incidents || []).filter((inc) => {
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
    if (providerFilter !== 'all' && inc.provider !== providerFilter) return false;
    return true;
  });

  const counts = {
    total: incidents?.length || 0,
    critical: (incidents || []).filter((i) => i.severity === 'critical').length,
    high: (incidents || []).filter((i) => i.severity === 'high').length,
    awaiting: (incidents || []).filter((i) => i.status === 'awaiting_approval').length,
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          Incident Management & AI Root-Cause Center
        </h2>
        <p className="text-xs text-slate-400">
          Automated multi-cloud incident detection across 14 clouds, LangGraph AI root-cause investigation, and human-in-the-loop safe remediation.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Incidents</span>
          <span className="text-xl font-bold text-white">{counts.total}</span>
        </div>
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] text-rose-400 uppercase font-bold block">Critical Severity</span>
          <span className="text-xl font-bold text-rose-400">{counts.critical}</span>
        </div>
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] text-amber-400 uppercase font-bold block">High Severity</span>
          <span className="text-xl font-bold text-amber-400">{counts.high}</span>
        </div>
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] text-violet-400 uppercase font-bold block">Awaiting Human Gate</span>
          <span className="text-xl font-bold text-violet-400">{counts.awaiting}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1424]/90 border border-slate-800/80 rounded-2xl p-3 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px]">Severity:</span>
          <div className="flex gap-1">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-2.5 py-1 rounded-xl uppercase text-[10px] font-bold transition ${
                  severityFilter === s
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">Provider:</span>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-[#090D18] border border-slate-800 rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Providers</option>
            {[
              'aws', 'gcp', 'azure', 'oci',
              'digitalocean', 'hetzner', 'render', 'cloudflare',
              'vercel', 'supabase', 'flyio', 'docker', 'kubernetes', 'private',
            ].map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Incidents Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incident List (2 cols) */}
        <div className="lg:col-span-2 bg-[#0D1424] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#090D18] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Incident #</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Cloud</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">AI RCA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`hover:bg-slate-800/40 cursor-pointer transition ${
                      selectedIncident?.id === inc.id ? 'bg-violet-950/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">{inc.incident_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{inc.title}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{inc.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded flex items-center justify-center bg-slate-950 border border-slate-800 p-0.5 shrink-0">
                          <ProviderLogo provider={inc.provider} size={11} />
                        </div>
                        <span className="uppercase text-[10px] font-bold text-slate-300">{inc.provider}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inc.severity === 'critical'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : inc.severity === 'high'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-slate-300 font-medium">{inc.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          investigateMutation.mutate(inc.id);
                        }}
                        disabled={investigateMutation.isPending}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 border border-violet-500/30 transition text-[11px]"
                      >
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredIncidents.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No incidents matching current criteria. All monitored platforms nominal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Incident Detail & Human-in-the-Loop Safe Approval Panel (1 col) */}
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-400" />
              AI Root-Cause Detail
            </h3>
            {selectedIncident && (
              <span className="text-[10px] font-mono text-cyan-400">
                {selectedIncident.incident_number}
              </span>
            )}
          </div>

          {selectedIncident ? (
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-sm text-slate-100">{selectedIncident.title}</h4>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{selectedIncident.description}</p>
              </div>

              {/* Root Cause Synthesis Box */}
              <div className="p-3.5 rounded-xl bg-[#090D18] border border-slate-800 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-violet-400 block">
                  LangGraph Root Cause Synthesis
                </span>
                <p className="text-slate-200 text-xs leading-relaxed">
                  {selectedIncident.root_cause ||
                    'Automated multi-agent investigation pending. Click "Investigate" to trigger root-cause analysis.'}
                </p>
              </div>

              {/* Human-in-the-loop Remediation Approval */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Controlled Safe Remediation Proposals
                </span>

                {(remediations || [])
                  .filter((r) => r.incident_id === selectedIncident.id || r.status === 'pending_approval')
                  .slice(0, 2)
                  .map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-xl bg-[#090D18] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{act.action_type}</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px]">
                          {act.risk_level} risk
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Target: {act.target}</p>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => approveMutation.mutate(act.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition shadow-sm"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          Approve Fix
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(act.id)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}

                {(!remediations || remediations.length === 0) && (
                  <p className="text-[11px] text-slate-500 py-1">
                    No remediation actions pending human approval.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Select an incident from the table to inspect its AI root cause and manage safe remediations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
