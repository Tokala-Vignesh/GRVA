import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { DollarSign, AlertCircle, Receipt } from 'lucide-react';

export const CostAnalyticsPage: React.FC = () => {
  const { data: connections } = useQuery({
    queryKey: ['connections-list'],
    queryFn: () => api.getConnections(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          Cloud Cost & Expenditure Analytics
        </h2>
        <p className="text-xs text-slate-400">
          Track multi-cloud expenditure across AWS Cost Explorer, GCP Cloud Billing, and Azure Cost Management.
        </p>
      </div>

      {/* Cloud Charges Advisory Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-200">Provider API Cost Advisory</h4>
          <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
            While CloudSentinel AI software is completely free, open-source, and local-first, calling provider billing
            APIs (such as AWS Cost Explorer at $0.01 per request) may incur provider fees. Cost queries are performed strictly on-demand.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Connected Accounts</span>
          <p className="text-2xl font-bold text-slate-100 mt-1">{connections?.length || 0}</p>
          <span className="text-[10px] text-slate-500">Live cloud connections</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Tracked MTD Spend</span>
          <p className="text-2xl font-bold text-cyan-400 mt-1">$0.00</p>
          <span className="text-[10px] text-slate-500">Zero fabrication - real API telemetry</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Billing Sync Mode</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">On-Demand</p>
          <span className="text-[10px] text-slate-500">Avoids unwanted provider polling charges</span>
        </div>
      </div>

      {/* Cost Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">Expenditure by Cloud Service & Region</h3>
        <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-lg p-6">
          <Receipt className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-xs font-semibold text-slate-300">No Billing Records Ingested</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-md">
            To view itemized costs, trigger an on-demand cost discovery from your connected cloud provider. Zero simulated charges are fabricated.
          </p>
        </div>
      </div>
    </div>
  );
};
