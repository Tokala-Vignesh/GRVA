import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { AgentFinding } from '../types';
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
    { name: 'Infrastructure Monitoring Agent', icon: Activity, desc: 'Telemetry normalization & status summarization' },
    { name: 'Anomaly Detection Agent', icon: Cpu, desc: 'Scikit-learn Isolation Forest scoring & feature evaluation' },
    { name: 'Predictive Analysis Agent', icon: TrendingUp, desc: 'Trend projection & time-to-exhaustion forecasting' },
    { name: 'Log Analysis Agent', icon: FileText, desc: 'Cloud event log inspection & pattern recognition' },
    { name: 'Security Intelligence Agent', icon: Shield, desc: 'Audit trails & anomalous privilege escalation' },
    { name: 'Root Cause Analysis Agent', icon: Search, desc: 'Cross-agent correlation & confidence ranking' },
    { name: 'Safe Remediation Agent', icon: Wrench, desc: 'Controlled non-destructive actions with human approval' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-cyan-400" />
            LangGraph Multi-Agent Intelligence System
          </h2>
          <p className="text-xs text-slate-400">
            Supervisor-orchestrated local agents with strict SQLite checkpointing and human-in-the-loop gates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={targetResourceId}
            onChange={(e) => setTargetResourceId(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          >
            <option value="">Select Resource (or Whole Cluster)</option>
            {(resources || []).map((r) => (
              <option key={r.id} value={r.id}>
                [{r.provider.toUpperCase()}] {r.resource_name}
              </option>
            ))}
          </select>

          <button
            onClick={() => investigateMutation.mutate()}
            disabled={investigateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${investigateMutation.isPending ? 'animate-spin' : ''}`} />
            {investigateMutation.isPending ? 'Running Workflow...' : 'Run Investigation'}
          </button>
        </div>
      </div>

      {/* Agents Roster */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((ag) => {
          const Icon = ag.icon;
          return (
            <div key={ag.name} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-semibold text-xs text-slate-200">{ag.name}</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">{ag.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Investigation Results / Trace */}
      {investigationResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm text-slate-100">Workflow Execution Trace</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">SQLite Checkpoint Persisted</span>
          </div>

          {/* Root Cause Banner */}
          {investigationResult.root_cause_analysis && (
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs space-y-1">
              <span className="font-bold text-cyan-400 uppercase tracking-wider text-[10px]">
                Root Cause Synthesis
              </span>
              <p className="text-slate-200 leading-relaxed whitespace-pre-line">
                {investigationResult.root_cause_analysis}
              </p>
            </div>
          )}

          {/* Agent Findings Feed */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Specialist Findings
            </h4>
            {(investigationResult.agent_findings || []).map((finding: AgentFinding, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-start justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-cyan-400">{finding.agent_name}</span>
                  <p className="text-slate-300 mt-1">{finding.summary}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-4">
                  Conf: {(finding.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
