import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CloudCog,
  Boxes,
  Activity,
  LineChart,
  BrainCircuit,
  AlertTriangle,
  ShieldCheck,
  DollarSign,
  FileSpreadsheet,
  BotMessageSquare,
  Settings,
  Shield,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  activeIncidentsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeIncidentsCount = 0 }) => {
  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Cloud Connections', path: '/connections', icon: CloudCog },
    { name: 'Resource Inventory', path: '/inventory', icon: Boxes },
    { name: 'Infrastructure Monitoring', path: '/monitoring', icon: Activity },
    { name: 'Metrics Explorer', path: '/metrics-explorer', icon: LineChart },
    { name: 'AI Intelligence', path: '/ai-intelligence', icon: BrainCircuit },
    {
      name: 'Incidents',
      path: '/incidents',
      icon: AlertTriangle,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined,
    },
    { name: 'Security Center', path: '/security', icon: ShieldCheck },
    { name: 'Cost Analytics', path: '/costs', icon: DollarSign },
    { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
    { name: 'AI Assistant', path: '/assistant', icon: BotMessageSquare },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-md shadow-cyan-900/40">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-sm tracking-wide flex items-center gap-1.5">
            CloudSentinel <span className="text-cyan-400 font-extrabold text-xs px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60">AI</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-tight">Unified Observability</p>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Local-First Mode
          </span>
          <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
