import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  activeIncidentsCount?: number;
}

interface NavGroup {
  groupName: string;
  items: {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeColor?: string;
    isAiSpecial?: boolean;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeIncidentsCount = 0 }) => {
  const [collapsed, setCollapsed] = useState(false);

  const navGroups: NavGroup[] = [
    {
      groupName: 'AI & Intelligence',
      items: [
        {
          name: 'AI Assistant',
          path: '/assistant',
          icon: BotMessageSquare,
          badge: 'Copilot',
          badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
          isAiSpecial: true,
        },
        {
          name: 'Multi-Agent RCA',
          path: '/ai-intelligence',
          icon: BrainCircuit,
          badge: '7 Agents',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          isAiSpecial: true,
        },
        {
          name: 'Incidents & RCA',
          path: '/incidents',
          icon: AlertTriangle,
          badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined,
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        },
      ],
    },
    {
      groupName: 'Observability Core',
      items: [
        { name: 'Overview', path: '/', icon: LayoutDashboard },
        { name: 'Resource Inventory', path: '/inventory', icon: Boxes },
        { name: 'Live Monitoring', path: '/monitoring', icon: Activity },
        { name: 'Metrics Explorer', path: '/metrics-explorer', icon: LineChart },
      ],
    },
    {
      groupName: 'Cloud & Governance',
      items: [
        { name: 'Cloud Connections', path: '/connections', icon: CloudCog, badge: '14 Clouds', badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
        { name: 'Security Center', path: '/security', icon: ShieldCheck },
        { name: 'Cost Analytics', path: '/costs', icon: DollarSign },
        { name: 'Reports & Export', path: '/reports', icon: FileSpreadsheet },
        { name: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-[#0A0F1D] border-r border-slate-800/80 flex flex-col h-screen select-none transition-all duration-300 relative z-40`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/60 shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <h1 className="font-bold text-slate-100 text-sm tracking-wide flex items-center gap-1.5">
                CloudSentinel{' '}
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  AI
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight">14 Multi-Cloud Observability</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.groupName} className="space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.groupName}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center ${
                      collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                    } rounded-xl text-xs font-medium transition-all group ${
                      isActive
                        ? item.isAiSpecial
                          ? 'bg-violet-950/50 text-violet-300 font-semibold border border-violet-800/60 shadow-sm shadow-violet-900/20'
                          : 'bg-cyan-950/50 text-cyan-300 font-semibold border border-cyan-800/60 shadow-sm shadow-cyan-900/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`
                  }
                  title={collapsed ? item.name : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        item.isAiSpecial ? 'text-violet-400 group-hover:text-violet-300' : 'text-slate-400 group-hover:text-cyan-400'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </div>
                  {!collapsed && item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${
                        item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-[#070B14]">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} text-[11px] text-slate-400`}>
          <span className="flex items-center gap-1.5" title="Local SQLite + OS Keyring">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            {!collapsed && <span className="text-[11px] font-medium text-slate-300">Local-First</span>}
          </span>
          {!collapsed && <span className="text-[10px] text-slate-500 font-mono">v1.2.0</span>}
        </div>
      </div>
    </aside>
  );
};
