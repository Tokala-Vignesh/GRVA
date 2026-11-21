import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { InventoryPage } from './pages/InventoryPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { MetricsExplorerPage } from './pages/MetricsExplorerPage';
import { AIIntelligencePage } from './pages/AIIntelligencePage';
import { IncidentsPage } from './pages/IncidentsPage';
import { SecurityCenterPage } from './pages/SecurityCenterPage';
import { CostAnalyticsPage } from './pages/CostAnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 5000,
    },
  },
});

const pageTitles: Record<string, { title: string; desc: string }> = {
  '/': { title: 'Overview Dashboard', desc: 'Unified multi-cloud infrastructure status & telemetry summary' },
  '/connections': { title: 'Cloud Connections', desc: 'Manage AWS, GCP, Azure, and private server credentials in OS Keyring' },
  '/inventory': { title: 'Resource Inventory', desc: 'Discovered cloud assets across all accounts and regions' },
  '/monitoring': { title: 'Live Infrastructure Monitoring', desc: 'Real-time resource utilization gauges and signals' },
  '/metrics-explorer': { title: 'Metrics Explorer', desc: 'Multi-metric time-series visualizer & predictive forecasting' },
  '/ai-intelligence': { title: 'AI Intelligence & Multi-Agent System', desc: 'LangGraph multi-agent root cause analysis & investigation workspace' },
  '/incidents': { title: 'Incident Center', desc: 'Automated alert threshold evaluation & safe controlled remediation' },
  '/security': { title: 'Security Intelligence', desc: 'Continuous cloud audit logging & privilege change detection' },
  '/costs': { title: 'Cost Analytics', desc: 'Multi-cloud spending tracking & provider billing analysis' },
  '/reports': { title: 'Reports & Export', desc: 'Generate local infrastructure health audits in PDF, CSV, and JSON' },
  '/assistant': { title: 'AI Cloud Assistant', desc: 'Natural language observability assistant grounded in local SQLite' },
  '/settings': { title: 'Settings & Diagnostics', desc: 'Configuration, database backups, polling intervals, and Ollama model selection' },
};

const MainLayout: React.FC = () => {
  const location = useLocation();
  const currentMeta = pageTitles[location.pathname] || {
    title: 'CloudSentinel AI',
    desc: 'Local-First Unified Multi-Cloud Infrastructure Monitoring',
  };

  const { data: health, refetch: refetchHealth, isRefetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30000,
  });

  const { data: overview } = useQuery({
    queryKey: ['monitoring-overview-counter'],
    queryFn: () => api.getOverview(),
    refetchInterval: 15000,
  });

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <Sidebar activeIncidentsCount={overview?.active_incidents || 0} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          title={currentMeta.title}
          description={currentMeta.desc}
          health={health || null}
          onRefresh={() => {
            refetchHealth();
            queryClient.invalidateQueries();
          }}
          isRefreshing={isRefetching}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/metrics-explorer" element={<MetricsExplorerPage />} />
            <Route path="/ai-intelligence" element={<AIIntelligencePage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/security" element={<SecurityCenterPage />} />
            <Route path="/costs" element={<CostAnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/assistant" element={<AIAssistantPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <MainLayout />
      </HashRouter>
    </QueryClientProvider>
  );
};

export default App;
