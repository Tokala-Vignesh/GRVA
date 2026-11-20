import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { ShieldCheck, ShieldAlert, Lock, AlertOctagon, CheckCircle2 } from 'lucide-react';

export const SecurityCenterPage: React.FC = () => {
  const { data: overview } = useQuery({
    queryKey: ['security-overview'],
    queryFn: () => api.getOverview(),
  });

  const securityEvents = overview?.recent_security_events || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Security Intelligence & Audit Center
        </h2>
        <p className="text-xs text-slate-400">
          Continuous analysis of cloud audit events (AWS CloudTrail, GCP Cloud Audit, Azure Activity Logs).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium">OS Keyring Credential Vault</span>
          </div>
          <p className="text-lg font-bold text-slate-100">{overview?.vault_backend || 'OS Native Keyring'}</p>
          <span className="text-[10px] text-emerald-400 font-medium">● Encrypted at rest (Zero plaintext in DB)</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium">Audit Events Analyzed</span>
          </div>
          <p className="text-lg font-bold text-slate-100">{securityEvents.length}</p>
          <span className="text-[10px] text-slate-500">Live event stream monitored</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <AlertOctagon className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Destructive Cloud Actions</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">Disabled by Default</p>
          <span className="text-[10px] text-slate-500">2-step human approval enforced</span>
        </div>
      </div>

      {/* Security Events Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">Recent Cloud Security Audit Events</h3>
        <div className="space-y-2">
          {securityEvents.map((evt, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{evt.name}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {evt.provider}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Time: {new Date(evt.time).toLocaleString()}</p>
              </div>

              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  evt.severity === 'critical'
                    ? 'bg-rose-500/20 text-rose-400'
                    : evt.severity === 'high'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {evt.severity}
              </span>
            </div>
          ))}

          {securityEvents.length === 0 && (
            <div className="py-8 text-center text-slate-500 text-xs">
              No anomalous security events or unauthorized IAM privilege changes detected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
