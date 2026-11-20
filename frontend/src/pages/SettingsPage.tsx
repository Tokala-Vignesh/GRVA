import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  Settings as SettingsIcon,
  Database,
  Cpu,
  Clock,
  Save,
  Download,
  Upload,
  CheckCircle2,
  Lock,
  Layers,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [backupPathInput, setBackupPathInput] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => api.getSettings(),
  });

  const { data: ollamaModels } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: () => api.getOllamaModels(),
  });

  const [form, setForm] = useState({
    theme: 'dark',
    discovery_interval_seconds: '900',
    metrics_interval_seconds: '300',
    private_host_interval_seconds: '60',
    alert_interval_seconds: '60',
    ollama_base_url: 'http://127.0.0.1:11434',
    ollama_model: 'llama3.2',
    data_retention_days: '30',
  });

  useEffect(() => {
    if (settingsData) {
      setForm((prev) => ({
        ...prev,
        ...settingsData,
      }));
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (newSettings: Record<string, string>) => api.updateSettings(newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const backupMutation = useMutation({
    mutationFn: () => api.createBackup(),
    onSuccess: (data) => {
      setBackupMessage(`Backup successfully created at: ${data.backup_path}`);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (path: string) => api.restoreBackup(path),
    onSuccess: (data) => {
      setBackupMessage(`Database successfully restored. Safety snapshot created.`);
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-cyan-400" />
          Application & Security Settings
        </h2>
        <p className="text-xs text-slate-400">
          Configure local-first polling cycles, local Ollama engine, OS keyring, and database retention.
        </p>
      </div>

      <div className="space-y-4">
        {/* Monitoring Intervals Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-sm">Background Monitoring Intervals</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Resource Discovery Interval (seconds)</label>
              <input
                type="number"
                value={form.discovery_interval_seconds}
                onChange={(e) => setForm({ ...form, discovery_interval_seconds: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Default: 900s (15 min) to prevent cloud API throttling.</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Cloud Metrics Collection Interval (seconds)</label>
              <input
                type="number"
                value={form.metrics_interval_seconds}
                onChange={(e) => setForm({ ...form, metrics_interval_seconds: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Default: 300s (5 min) aligned with CloudWatch / Cloud Monitoring.</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Private Linux Server Metric Interval (seconds)</label>
              <input
                type="number"
                value={form.private_host_interval_seconds}
                onChange={(e) => setForm({ ...form, private_host_interval_seconds: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Default: 60s for local Prometheus node exporter scraping.</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Data Retention Window (days)</label>
              <input
                type="number"
                value={form.data_retention_days}
                onChange={(e) => setForm({ ...form, data_retention_days: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Telemetry older than this will be automatically pruned.</span>
            </div>
          </div>
        </div>

        {/* Ollama Configuration Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-sm">Local Ollama AI Engine</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Ollama Daemon Base URL</label>
              <input
                type="text"
                value={form.ollama_base_url}
                onChange={(e) => setForm({ ...form, ollama_base_url: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Strictly loopback (http://127.0.0.1:11434).</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Selected Local Model</label>
              <input
                type="text"
                value={form.ollama_model}
                onChange={(e) => setForm({ ...form, ollama_model: e.target.value })}
                placeholder="e.g. llama3.2, mistral, qwen2.5"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">
                Installed models: {(ollamaModels?.models || []).join(', ') || 'None detected yet'}
              </span>
            </div>
          </div>
        </div>

        {/* Credential Vault & Database Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-sm">Database & Backup Vault</h3>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-semibold text-slate-200">OS Credential Vault Backend</span>
                <p className="text-[11px] text-slate-400">{settingsData?.vault_backend || 'OS Native Keyring'}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
              PROTECTED
            </span>
          </div>

          {/* Backup & Restore Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              {backupMutation.isPending ? 'Backing up...' : 'Create SQLite Database Backup (.db.gz)'}
            </button>
          </div>

          {backupMessage && (
            <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-[11px]">
              {backupMessage}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </button>

          {saveSuccess && (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" /> Settings updated successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
