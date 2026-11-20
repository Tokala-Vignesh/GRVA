import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Search, Filter, Boxes, RefreshCw } from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data: resources, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['resources-inventory', providerFilter, statusFilter],
    queryFn: () =>
      api.getResources(
        providerFilter === 'all' ? undefined : providerFilter,
        statusFilter === 'all' ? undefined : statusFilter,
      ),
    refetchInterval: 20000,
  });

  const filteredResources = (resources || []).filter((r) => {
    const matchesSearch =
      r.resource_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.resource_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.ip_address && r.ip_address.includes(searchTerm));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Resource Inventory</h2>
          <p className="text-xs text-slate-400">
            Real multi-cloud compute inventory automatically discovered via provider APIs.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh Inventory
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, ID, or IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Provider Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">Provider:</span>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Providers</option>
            <option value="aws">AWS</option>
            <option value="gcp">GCP</option>
            <option value="azure">Azure</option>
            <option value="private">Private</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[11px]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Region / Zone</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">CPU %</th>
                <th className="py-3 px-4">Memory %</th>
                <th className="py-3 px-4">Last Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredResources.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-100">{r.resource_name}</div>
                    <div className="font-mono text-[10px] text-slate-500">{r.resource_id}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block uppercase font-bold text-[10px] px-2 py-0.5 rounded ${
                        r.provider === 'aws'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : r.provider === 'gcp'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : r.provider === 'azure'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {r.provider}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <div>{r.region}</div>
                    {r.zone && <div className="text-[10px] text-slate-500">{r.zone}</div>}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {r.instance_type || 'virtual_machine'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                    {r.ip_address || r.private_ip || 'Private/Internal'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.status === 'running'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {r.latest_cpu !== null ? (
                      <span className="font-semibold text-slate-200">{r.latest_cpu.toFixed(1)}%</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {r.latest_mem !== null ? (
                      <span className="font-semibold text-slate-200">{r.latest_mem.toFixed(1)}%</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
                        Agent req.
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {r.last_collected_at ? new Date(r.last_collected_at).toLocaleTimeString() : 'Pending'}
                  </td>
                </tr>
              ))}

              {filteredResources.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No resources matching filters.
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
