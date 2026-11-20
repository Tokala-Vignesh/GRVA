import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { FileText, Download, CheckCircle, FileSpreadsheet, FileCode } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<string>('infrastructure_health');
  const [format, setFormat] = useState<string>('pdf');
  const [exportResult, setExportResult] = useState<any>(null);

  const exportMutation = useMutation({
    mutationFn: () => api.exportReport(reportType, format),
    onSuccess: (data) => {
      setExportResult(data);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
          Local Report Generation & Data Export
        </h2>
        <p className="text-xs text-slate-400">
          Export local infrastructure audits, incident logs, and telemetry to PDF, CSV, and JSON.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm max-w-2xl space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">Select Report Category</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'infrastructure_health', label: 'Infrastructure Health', desc: 'Compute resources, status, and CPU metrics' },
              { id: 'incidents', label: 'Incidents Summary', desc: 'All detected alerts, root cause, and remediations' },
              { id: 'security_events', label: 'Security Audit', desc: 'Audit logs, IAM changes, and security events' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id)}
                className={`p-3 rounded-xl border text-left transition ${
                  reportType === item.id
                    ? 'bg-cyan-500/10 border-cyan-500 text-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-slate-200">{item.label}</div>
                <div className="text-[10px] text-slate-500 mt-1">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">Export Format</label>
          <div className="flex gap-3">
            {[
              { id: 'pdf', label: 'PDF Document (.pdf)', icon: FileText },
              { id: 'csv', label: 'Comma-Separated (.csv)', icon: FileSpreadsheet },
              { id: 'json', label: 'Structured JSON (.json)', icon: FileCode },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition ${
                    format === f.id
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportMutation.isPending ? 'Generating Report...' : `Generate & Export ${format.toUpperCase()}`}
          </button>
        </div>

        {exportResult && (
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Report Generated Successfully</p>
              {exportResult.file_path && (
                <p className="text-[11px] font-mono text-slate-400 mt-1 break-all">
                  Saved to: {exportResult.file_path}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
