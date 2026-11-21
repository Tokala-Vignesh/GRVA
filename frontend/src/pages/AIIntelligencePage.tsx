import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { AgentFinding } from '../types';
import { ProviderLogo } from '../components/ProviderLogos';
import {
  BrainCircuit,
  Activity,
  Cpu,
  TrendingUp,
  FileText,
  Shield,
  Search,
  Wrench,
  CheckCircle2,
  Play,
  Sparkles,
  ArrowRight,
  Sliders,
  Check,
  AlertOctagon,
  Clock,
  Layers,
} from 'lucide-react';

export const AIIntelligencePage: React.FC = () => {
  const [targetResourceId, setTargetResourceId] = useState<string>('');
  const [investigationResult, setInvestigationResult] = useState<any>(null);

  const { data: resources } = useQuery({
    queryKey: ['ai-resources'],
    queryFn: () => api.getResources(),
  });

  const investigateMutation = useMutation({
    mutationFn: () =>
      api.investigateAI({
        resource_id: targetResourceId || (resources && resources.length > 0 ? resources[0].id : 'system'),
        query: 'Full multi-agent root cause and predictive health investigation',
      }),
    onSuccess: (data) => {
      setInvestigationResult(data);
    },
  });

  const agents = [
    { id: 'monitoring', step: 1, name: 'Infrastructure Monitoring', icon: Activity, role: 'Telemetry Ingestion & Status Normalization' },
    { id: 'anomaly', step: 2, name: 'Anomaly Detection Agent', icon: Cpu, role: 'Scikit-Learn Isolation Forest Multivariate Scoring' },
    { id: 'prediction', step: 3, name: 'Predictive Analysis Agent', icon: TrendingUp, role: 'Linear Trend Projection & Capacity Exhaustion' },
    { id: 'log', step: 4, name: 'Cloud Log Analysis Agent', icon: FileText, role: 'Multi-Cloud Audit Trails & Anomaly Pattern Recognition' },
    { id: 'security', step: 5, name: 'Security Intelligence Agent', icon: Shield, role: 'IAM Privilege Review & Unusual Access Correlation' },
    { id: 'rca', step: 6, name: 'Root Cause Synthesis Agent', icon: Search, role: 'Cross-Agent Evidence Correlation & Hypothesis Synthesis' },
    { id: 'remediation', step: 7, name: 'Safe Remediation Agent', icon: Wrench, role: 'Non-Destructive Fix Formulation with 2-Step Approval' },
  ];

  return (
    <div className="space-y-5">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-violet-400" />
            LangGraph Multi-Agent Intelligence System
          </h2>
          <p className="text-xs text-slate-400">
            Supervisor-orchestrated local agents with strict SQLite state checkpointing and human-in-the-loop safety gates.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={targetResourceId}
            onChange={(e) => setTargetResourceId(e.target.value)}
            className="bg-[#0D1424] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition max-w-[260px]"
          >
            <option value="">Whole Infrastructure Scope</option>
            {(resources || []).map((r) => (
              <option key={r.id} value={r.id}>
                [{r.provider.toUpperCase()}] {r.resource_name} ({r.resource_id})
              </option>
            ))}
          </select>

          <button
            onClick={() => investigateMutation.mutate()}
            disabled={investigateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-950/40 transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${investigateMutation.isPending ? 'animate-spin' : ''}`} />
            {investigateMutation.isPending ? 'Executing Graph...' : 'Run 7-Agent RCA'}
          </button>
        </div>
      </div>

      {/* Visual LangGraph Directed Pipeline */}
      <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            Directed Multi-Agent Pipeline Topology
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
            StateGraph: 7 Nodes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 pt-2">
          {agents.map((ag, idx) => {
            const Icon = ag.icon;
            const isFinished = investigationResult !== null;
            const isRunning = investigateMutation.isPending;

            return (
              <div
                key={ag.id}
                className={`relative p-3 rounded-2xl border transition text-left flex flex-col justify-between space-y-2 ${
                  isFinished
                    ? 'bg-violet-950/30 border-violet-800/50 text-slate-200'
                    : isRunning
                    ? 'bg-cyan-950/20 border-cyan-800/50 animate-pulse'
                    : 'bg-[#090D18] border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono flex items-center justify-center font-bold text-violet-300">
                    {ag.step}
                  </span>
                  <div className="p-1 rounded-lg bg-slate-900/80 text-violet-400">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-xs text-slate-100 leading-snug">{ag.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">{ag.role}</p>
                </div>

                {isFinished && (
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 pt-1 border-t border-slate-800/60">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Investigation Results Display */}
      {investigationResult && (
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h3 className="font-bold text-sm text-slate-100">Workflow Execution Trace & Findings</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-[#090D18] border border-slate-800">
              Checkpointed to SQLite
            </span>
          </div>

          {/* Root Cause Banner */}
          {investigationResult.root_cause_analysis && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/60 to-cyan-950/40 border border-violet-800/60 text-xs space-y-2 shadow-lg">
              <span className="font-bold text-violet-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5" />
                Root Cause Synthesis
              </span>
              <p className="text-slate-100 leading-relaxed text-[12px] whitespace-pre-line">
                {investigationResult.root_cause_analysis}
              </p>
            </div>
          )}

          {/* Findings Feed */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Specialist Agent Reports
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(investigationResult.agent_findings || []).map((finding: AgentFinding, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#090D18] border border-slate-800/80 rounded-2xl flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-violet-300">{finding.agent_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                      Conf: {(finding.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">{finding.summary}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Remediation Action Proposal & Safe Gate */}
          {investigationResult.proposed_remediations && investigationResult.proposed_remediations.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#090D18] border border-emerald-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4" />
                  Proposed Remediation Actions (Human-in-the-Loop Approval Required)
                </span>
                <span className="text-[10px] font-mono text-emerald-300 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50">
                  Zero Destructive Cloud Actions Enforced
                </span>
              </div>

              <div className="space-y-2">
                {investigationResult.proposed_remediations.map((action: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0D1424] border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-100">{action.action_type || 'Restart Service'}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Target: {action.target || 'Selected Asset'}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
                      Awaiting Human Approval in Incidents Tab
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
