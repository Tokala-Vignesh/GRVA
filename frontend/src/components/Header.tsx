import React from 'react';
import { RefreshCw, Server, Cpu, Database, CheckCircle2, AlertCircle } from 'lucide-react';
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
    <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Keyring Vault Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>OS Keyring Active</span>
        </div>

        {/* Ollama Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
            isOllamaOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
          title={
            isOllamaOnline
              ? `Ollama Online (${health?.ollama?.version}) at ${health?.ollama?.base_url}`
              : `Ollama Offline at ${health?.ollama?.base_url || '127.0.0.1:11434'}`
          }
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{isOllamaOnline ? 'Ollama AI Active' : 'Ollama Offline'}</span>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
