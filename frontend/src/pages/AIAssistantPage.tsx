import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ProviderLogo } from '../components/ProviderLogos';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import {
  BotMessageSquare,
  Send,
  Sparkles,
  User,
  Cpu,
  ChevronDown,
  RefreshCw,
  Cloud,
  HardDrive,
  Info,
  Check,
  Settings2,
  Activity,
  Layers,
  ShieldAlert,
  TrendingUp,
  PanelRightClose,
  PanelRightOpen,
  Zap,
  ArrowRight,
  Search,
  ExternalLink,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { OllamaModelDetail } from '../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  grounding?: any;
  modelUsed?: string;
  time: string;
}

type IntentCategory = 'performance' | 'multicloud' | 'security' | 'rca';

export const AIAssistantPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [inputQuery, setInputQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('llama3.2');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showContextPane, setShowContextPane] = useState(true);
  const [selectedIntent, setSelectedIntent] = useState<IntentCategory>('performance');
  const [isStreaming, setIsStreaming] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: 'Hello! I am your local CloudSentinel AI Copilot, grounded strictly in your local SQLite multi-cloud telemetry.\n\nI monitor all 14 supported cloud, container, and bare-metal platforms with zero hallucination. Select an intent below or ask me about resource spikes, multi-cloud comparisons, or active investigations.',
      time: new Date().toLocaleTimeString(),
    },
  ]);

  // Fetch Ollama health status
  const { data: ollamaStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['ollama-status'],
    queryFn: () => api.getOllamaStatus(),
    refetchInterval: 30000,
  });

  // Fetch installed Ollama models with metadata
  const { data: ollamaModelsData, refetch: refetchModels, isFetching: isFetchingModels } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: () => api.getOllamaModels(),
  });

  // Fetch active settings to get default configured model
  const { data: settingsData } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => api.getSettings(),
  });

  // Fetch live overview for context panel
  const { data: overviewData } = useQuery({
    queryKey: ['monitoring-overview'],
    queryFn: () => api.getOverview(),
    refetchInterval: 15000,
  });

  // Fetch resources list for target selection
  const { data: resourcesData } = useQuery({
    queryKey: ['resources-list'],
    queryFn: () => api.getResources(),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (settingsData && settingsData.ollama_model) {
      setSelectedModel(settingsData.ollama_model);
    } else if (ollamaModelsData?.details && ollamaModelsData.details.length > 0) {
      // Prefer local non-cloud models if available to prevent 402 payment requirements
      const localModel = ollamaModelsData.details.find((m) => !m.is_remote && !m.name.includes(':cloud'));
      if (localModel) {
        setSelectedModel(localModel.name);
      } else if (ollamaModelsData.models && ollamaModelsData.models.length > 0) {
        setSelectedModel(ollamaModelsData.models[0]);
      }
    } else if (ollamaModelsData?.models && ollamaModelsData.models.length > 0) {
      setSelectedModel(ollamaModelsData.models[0]);
    }
  }, [settingsData, ollamaModelsData]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchModelMutation = useMutation({
    mutationFn: (newModel: string) => api.setOllamaModel(newModel),
    onSuccess: (data) => {
      setSelectedModel(data.active_model);
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      setIsDropdownOpen(false);
      setShowCustomInput(false);
      setCustomModelInput('');
    },
  });

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isStreaming) return;

    const userMsgId = Math.random().toString(36).substring(7);
    const botMsgId = Math.random().toString(36).substring(7);

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: query,
        time: new Date().toLocaleTimeString(),
      },
      {
        id: botMsgId,
        sender: 'assistant',
        text: '',
        modelUsed: selectedModel,
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setInputQuery('');
    setIsStreaming(true);

    api.askAIStream(
      query,
      selectedModel,
      undefined,
      (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, text: m.text + token } : m))
        );
      },
      (modelUsed, grounding) => {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId ? { ...m, modelUsed, grounding } : m
          )
        );
      },
      (err) => {
        // Fallback to standard chat call if stream fails
        api.askAI(query, undefined, selectedModel)
          .then((res) => {
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, text: res.response, grounding: res.grounding_data, modelUsed: res.model_used }
                  : m
              )
            );
          })
          .catch((e) => {
            setIsStreaming(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, text: `Error processing query: ${e.message || err.message}` }
                  : m
              )
            );
          });
      }
    );
  };

  const intentPresets: Record<IntentCategory, { label: string; icon: any; questions: string[] }> = {
    performance: {
      label: 'Performance & Spikes',
      icon: Zap,
      questions: [
        'Show the most CPU-intensive resources.',
        'Which nodes are consuming high memory or swapping?',
        'Are there servers approaching resource capacity exhaustion?',
        'List top utilized Docker containers and Kubernetes pods.',
      ],
    },
    multicloud: {
      label: 'Multi-Cloud Cross-Check',
      icon: Layers,
      questions: [
        'List all projects and web services running on Render.',
        'Compare AWS, GCP, Azure, and OCI infrastructure health.',
        'Summarize inventory count across all 14 connected providers.',
        'Which cloud platform has the highest number of degraded instances?',
      ],
    },
    security: {
      label: 'Security & Audit Logs',
      icon: ShieldAlert,
      questions: [
        'Are there suspicious login attempts or unauthorized IAM changes?',
        'Summarize recent high-severity cloud audit events.',
        'Verify OS Keyring credential encryption status.',
        'Check for anomalous API calls or privilege escalations.',
      ],
    },
    rca: {
      label: 'Incident Root Cause',
      icon: TrendingUp,
      questions: [
        'Show active incidents and current root-cause hypotheses.',
        'Run multivariate anomaly detection with Isolation Forest.',
        'What remediations are awaiting two-step human approval?',
        'Correlate recent metric anomalies with cloud provider outages.',
      ],
    },
  };

  const activeModelDetails = ollamaModelsData?.details?.find((m) => m.name === selectedModel);
  const isCloudModel = activeModelDetails?.is_remote || selectedModel.includes('cloud');

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-3">
      {/* Top Banner & Model Switcher Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#0D1424]/90 backdrop-blur-xl border border-slate-800/80 p-3.5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-violet-950/60 shrink-0">
            <BotMessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 tracking-tight">CloudSentinel AI Copilot</h2>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-violet-950/80 text-violet-300 border border-violet-800/60">
                Grounding v2
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Grounded multi-agent reasoning across all 14 clouds, container runtimes, and bare-metal nodes.
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
          {/* Ollama Status Pill */}
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border ${
              ollamaStatus?.available
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                : 'bg-amber-950/40 text-amber-300 border-amber-800/50'
            }`}
            title={ollamaStatus?.error || 'Local Ollama Daemon reachable'}
          >
            <span className={`w-2 h-2 rounded-full ${ollamaStatus?.available ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {ollamaStatus?.available ? 'Ollama Online' : 'Deterministic Grounding Active'}
          </span>

          {/* Model Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#090D16] hover:bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-mono text-slate-200 transition shadow-sm"
            >
              {isCloudModel ? (
                <Cloud className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="font-semibold text-slate-100 max-w-[140px] truncate">{selectedModel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-84 bg-[#090D16] border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 text-xs space-y-2">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800 pb-1.5">
                  <span>Installed Ollama Models</span>
                  <button
                    onClick={() => {
                      refetchModels();
                      refetchStatus();
                    }}
                    disabled={isFetchingModels}
                    className="p-1 hover:text-cyan-400 rounded transition"
                    title="Refresh models from Ollama daemon"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {ollamaModelsData?.models && ollamaModelsData.models.length > 0 ? (
                    ollamaModelsData.models.map((modelName) => {
                      const detail = ollamaModelsData.details?.find((d) => d.name === modelName);
                      const isRemote = detail?.is_remote || modelName.includes('cloud');
                      const isSelected = selectedModel === modelName;

                      return (
                        <button
                          key={modelName}
                          onClick={() => switchModelMutation.mutate(modelName)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition ${
                            isSelected
                              ? 'bg-violet-950/60 border border-violet-800/50 text-violet-200'
                              : 'hover:bg-slate-900/80 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {isRemote ? (
                              <Cloud className="w-4 h-4 text-indigo-400 shrink-0" />
                            ) : (
                              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <div className="truncate">
                              <span className="font-mono text-xs block truncate font-semibold text-slate-100">
                                {modelName}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                {detail?.parameter_size && (
                                  <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                                    {detail.parameter_size}
                                  </span>
                                )}
                                {detail?.quantization_level && (
                                  <span className="px-1 py-0.2 rounded bg-slate-800/80 text-slate-400">
                                    {detail.quantization_level}
                                  </span>
                                )}
                                <span>{isRemote ? 'Cloud Hosted' : 'Local GPU/CPU'}</span>
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-violet-400 shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-slate-500 text-[11px]">
                      No models detected. Pull one with <code className="text-cyan-400">ollama run llama3.2</code>
                    </div>
                  )}
                </div>

                {/* Custom Model Input Option */}
                <div className="border-t border-slate-800 pt-2 px-1">
                  {!showCustomInput ? (
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-medium"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Switch to custom model tag...
                    </button>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customModelInput.trim()) {
                          switchModelMutation.mutate(customModelInput.trim());
                        }
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        placeholder="e.g. qwen2.5:14b, phi3, mistral"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!customModelInput.trim()}
                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs transition disabled:opacity-50"
                      >
                        Set
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Context Pane Toggle Button */}
          <button
            onClick={() => setShowContextPane(!showContextPane)}
            className={`p-1.5 rounded-xl border transition ${
              showContextPane
                ? 'bg-violet-950/40 text-violet-300 border-violet-800/60'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title={showContextPane ? 'Hide Telemetry Context Inspector' : 'Show Telemetry Context Inspector'}
          >
            {showContextPane ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Cloud Model Fallback Notice */}
      {isCloudModel && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-950/40 border border-indigo-900/60 rounded-xl text-[11px] text-indigo-300">
          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
            Active model <strong>{selectedModel}</strong> is cloud-backed. If Ollama Cloud limits or credits are exhausted (HTTP 402), CloudSentinel automatically answers using verified local SQLite telemetry.
          </span>
        </div>
      )}

      {/* Main Dual-Pane Workspace */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left Pane: Chat Stream & Prompt Dock (65% width) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0B101E]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          {/* Intent Preset Category Switcher */}
          <div className="p-2 border-b border-slate-800/80 bg-[#080D18]/90 flex items-center gap-1.5 overflow-x-auto text-xs">
            {(Object.keys(intentPresets) as IntentCategory[]).map((cat) => {
              const info = intentPresets[cat];
              const Icon = info.icon;
              const isSelected = selectedIntent === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedIntent(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition shrink-0 ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-900/30'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Suggested Intent Pills */}
          <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-500 shrink-0 font-medium text-[10px] uppercase tracking-wider">Quick Inquiries:</span>
            {intentPresets[selectedIntent].questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-violet-500/40 transition shrink-0 truncate max-w-xs"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const topCpuList = msg.grounding?.utilization?.top_cpu || [];

              return (
                <div key={msg.id} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-md ${
                      isUser
                        ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white'
                        : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-3xl rounded-2xl p-4 text-xs ${
                      isUser
                        ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-tr-none shadow-md'
                        : 'bg-[#0E1528] border border-slate-800/90 text-slate-200 rounded-tl-none space-y-3 shadow-md'
                    }`}
                  >
                    {msg.text ? (
                      <MarkdownRenderer content={msg.text} />
                    ) : (
                      <div className="flex items-center gap-2 py-1 text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-100" />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse delay-200" />
                        <span className="text-[11px] text-slate-400 ml-1">Generating response...</span>
                      </div>
                    )}

                    {/* Inline Telemetry Highlight Cards if CPU-intensive resources detected */}
                    {!isUser && topCpuList.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl bg-[#090D18] border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            Live Telemetry Rankings (Top Utilized Nodes)
                          </span>
                          <span className="text-[10px] text-slate-500">Sorted by CPU %</span>
                        </div>

                        <div className="space-y-1.5">
                          {topCpuList.slice(0, 3).map((r: any) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-950 border border-slate-800 shrink-0">
                                  <ProviderLogo provider={r.provider} size={12} />
                                </div>
                                <div className="truncate">
                                  <span className="font-semibold text-slate-100 truncate block">{r.resource_name}</span>
                                  <span className="font-mono text-[9px] text-slate-500 uppercase">{r.provider} • {r.region}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <span className="font-bold text-slate-200">
                                    {r.cpu_usage_percent !== null ? `${r.cpu_usage_percent.toFixed(1)}%` : 'N/A'}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">CPU Load</span>
                                </div>
                                <button
                                  onClick={() => navigate('/ai-intelligence')}
                                  className="px-2 py-1 rounded bg-violet-600/20 text-violet-300 hover:bg-violet-600/40 border border-violet-500/30 text-[10px] font-medium transition"
                                >
                                  Investigate RCA
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata Stamp */}
                    {!isUser && (
                      <div className="text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-800/80 pt-2 mt-2">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Grounded in Verified SQLite Telemetry
                        </span>
                        {msg.modelUsed && (
                          <span className="font-mono bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                            Engine: {msg.modelUsed}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isStreaming && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-950/60 border border-violet-800/60 flex items-center justify-center text-violet-400">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-[#0E1528] border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-400 shadow-md">
                  Streaming response using <strong>{selectedModel}</strong>...
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Prompt Dock */}
          <div className="p-3 border-t border-slate-800/80 bg-[#080D18]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Ask anything across your 14 clouds (e.g. CPU spikes, failed pods, security events)...`}
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  className="w-full bg-[#0E1528] border border-slate-800 focus:border-cyan-500 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isStreaming || !inputQuery.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-cyan-950/40 transition disabled:opacity-50"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Pane: Real-Time Multi-Cloud Grounding Context (35% width, toggleable) */}
        {showContextPane && (
          <div className="w-84 xl:w-96 flex flex-col space-y-3 shrink-0 overflow-y-auto">
            {/* Active Model Inspector Card */}
            <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-violet-400" />
                  Active Inference Engine
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  Ollama
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Model Tag:</span>
                  <span className="font-mono font-semibold text-slate-200 truncate max-w-[150px]">{selectedModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Execution Mode:</span>
                  <span className={`font-semibold ${isCloudModel ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {isCloudModel ? 'Ollama Cloud Remote' : '100% Offline Local'}
                  </span>
                </div>
                {activeModelDetails?.parameter_size && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Parameters:</span>
                    <span className="font-mono text-slate-200">{activeModelDetails.parameter_size}</span>
                  </div>
                )}
                {activeModelDetails?.quantization_level && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quantization:</span>
                    <span className="font-mono text-slate-200">{activeModelDetails.quantization_level}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Live SQLite Telemetry Context Card */}
            <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Telemetry Grounding State
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#080D18] p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Total Resources</span>
                  <span className="text-base font-bold text-white">{overviewData?.total_resources ?? 0}</span>
                </div>
                <div className="bg-[#080D18] p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Connections</span>
                  <span className="text-base font-bold text-cyan-400">{overviewData?.total_connections ?? 0}</span>
                </div>
                <div className="bg-[#080D18] p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Healthy Nodes</span>
                  <span className="text-base font-bold text-emerald-400">{overviewData?.healthy_resources ?? 0}</span>
                </div>
                <div className="bg-[#080D18] p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Active Incidents</span>
                  <span className="text-base font-bold text-rose-400">{overviewData?.active_incidents ?? 0}</span>
                </div>
              </div>

              {/* Supported Platforms Tag Grid */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Grounding Across 14 Clouds:
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    'aws', 'gcp', 'azure', 'oci',
                    'digitalocean', 'hetzner', 'render', 'cloudflare',
                    'vercel', 'supabase', 'flyio', 'docker', 'kubernetes', 'private',
                  ].map((prov) => (
                    <div
                      key={prov}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#080D18] border border-slate-800 text-[9px] font-mono text-slate-300 uppercase"
                    >
                      <ProviderLogo provider={prov} size={10} />
                      <span>{prov}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick 1-Click Multi-Agent RCA Launcher */}
            <div className="bg-[#0D1424] border border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-2.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-400" />
                LangGraph Multi-Agent Trigger
              </span>
              <p className="text-[11px] text-slate-400">
                Invoke the 7 domain specialist agents to run root-cause analysis on any connected asset.
              </p>
              <button
                onClick={() => navigate('/ai-intelligence')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 font-semibold text-xs border border-violet-500/30 transition shadow-sm"
              >
                <span>Open Multi-Agent Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
