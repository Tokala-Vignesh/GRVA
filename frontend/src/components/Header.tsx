import React from 'react';
import { RefreshCw, Server, Cpu, Database, CheckCircle2, AlertCircle, Cloud, Sparkles } from 'lucide-react';
import { SystemHealth } from '../types';

interface HeaderProps {
  title: string;
  description?: string;
  health: SystemHealth | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  description,
  health,
  onRefresh,
  isRefreshing = false,
}) => {
  const isOllamaOnline = health?.ollama?.available ?? false;

  return (
    <header className="h-16 bg-[#090D18]/80 backdrop-blur-xl border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30 transition-all">
      <div>
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          {title}
        </h2>
        {description && <p className="text-xs text-slate-400 font-normal">{description}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* 14 Multi-Cloud Capability Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
          <Cloud className="w-3.5 h-3.5 text-cyan-400" />
          <span>14 Clouds Supported</span>
        </div>

        {/* Keyring Vault Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>OS Keyring Active</span>
        </div>

        {/* Ollama Status Badge with AI Glow */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
            isOllamaOnline
              ? 'bg-violet-950/40 text-violet-300 border-violet-800/50 shadow-sm shadow-violet-900/20'
              : 'bg-amber-950/40 text-amber-300 border-amber-800/50'
          }`}
          title={
            isOllamaOnline
              ? `Ollama AI Online (${health?.ollama?.version}) at ${health?.ollama?.base_url}`
              : `Ollama Offline at ${health?.ollama?.base_url || '127.0.0.1:11434'} (Using Grounded Telemetry Fallback)`
          }
        >
          <div className="relative flex items-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                isOllamaOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>
          <span>{isOllamaOnline ? 'AI Copilot Ready' : 'Deterministic Mode'}</span>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition border border-slate-800 disabled:opacity-50 text-xs font-medium"
            title="Refresh All Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
};
