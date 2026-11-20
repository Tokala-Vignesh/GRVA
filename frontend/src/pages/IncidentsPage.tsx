import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Incident } from '../types';
import {
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Search,
  Sparkles,
} from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          Incident Management Center
        </h2>
        <p className="text-xs text-slate-400">
          Automated multi-cloud incident detection, LangGraph AI root-cause investigation, and human-in-the-loop safe remediation.
        </p>
      </div>

      {/* Incidents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Incident #</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">AI Investigation</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(incidents || []).map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`hover:bg-slate-800/40 cursor-pointer transition ${
                    selectedIncident?.id === inc.id ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-200">{inc.incident_number}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-100">{inc.title}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{inc.description}</div>
                  </td>
                  <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-400">{inc.provider}</td>
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
                    <span className="capitalize text-slate-300">{inc.status}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        inc.ai_investigation_status === 'completed'
                          ? 'text-emerald-400'
                          : inc.ai_investigation_status === 'running'
                          ? 'text-cyan-400 animate-pulse'
                          : 'text-slate-500'
                      }`}
                    >
                      {inc.ai_investigation_status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        investigateMutation.mutate(inc.id);
                      }}
                      disabled={investigateMutation.isPending}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30 transition text-[11px]"
                    >
                      <Sparkles className="w-3 h-3" />
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}

              {(!incidents || incidents.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No active incidents reported. Infrastructure is healthy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Root Cause & Safe Remediation Action Panel */}
      {selectedIncident && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-sm text-slate-100">
                Incident Detail: {selectedIncident.incident_number} — {selectedIncident.title}
              </h3>
              <p className="text-xs text-slate-400">{selectedIncident.description}</p>
            </div>
            <button
              onClick={() => setSelectedIncident(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>

          {/* Root cause analysis */}
          {selectedIncident.root_cause ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <span className="font-bold text-cyan-400 uppercase tracking-wider text-[10px]">
                AI Verified Root Cause
              </span>
              <p className="text-slate-200 whitespace-pre-line leading-relaxed">
                {selectedIncident.root_cause}
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 flex items-center justify-between">
              <span>Root cause investigation not yet run.</span>
              <button
                onClick={() => investigateMutation.mutate(selectedIncident.id)}
                className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
              >
                Trigger LangGraph Multi-Agent Investigation
              </button>
            </div>
          )}

          {/* Safe Remediation Actions Approval Section */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Controlled Safe Remediation (Human-in-the-Loop Gate)
            </h4>

            {(remediations || []).map((action) => (
              <div
                key={action.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 uppercase">{action.action_type.replace('_', ' ')}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      Target: {action.target}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Risk: {action.risk_level}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-1 text-[11px]">
                    Status: <span className="font-bold text-slate-300">{action.status}</span>
                    {action.execution_output && ` • ${action.execution_output}`}
                  </p>
                </div>

                {action.status === 'pending_approval' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approveMutation.mutate(action.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                    >
                      Approve & Execute
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(action.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}

            {(!remediations || remediations.length === 0) && (
              <p className="text-xs text-slate-500 italic">No remediation actions currently pending.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
