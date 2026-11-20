import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { BotMessageSquare, Send, Sparkles, User, Database, Cpu, AlertCircle } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  grounding?: any;
  modelUsed?: string;
  time: string;
}

export const AIAssistantPage: React.FC = () => {
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: 'Hello! I am your local CloudSentinel AI Assistant, grounded strictly in your local SQLite telemetry. Ask me about resource CPU spikes, incident root causes, or infrastructure comparisons across AWS, GCP, Azure, and your private Linux servers.',
      time: new Date().toLocaleTimeString(),
    },
  ]);

  const { data: ollamaStatus } = useQuery({
    queryKey: ['ollama-status'],
    queryFn: () => api.getOllamaStatus(),
  });

  const chatMutation = useMutation({
    mutationFn: (query: string) => api.askAI(query),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.response,
          grounding: data.grounding_data,
          modelUsed: data.model_used,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    },
    onError: (err: any) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Error processing query: ${err.message}`,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    },
  });

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: query,
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setInputQuery('');
    chatMutation.mutate(query);
  };

  const sampleQuestions = [
    'Show the most CPU-intensive resources.',
    'Compare AWS, GCP and Azure infrastructure health.',
    'Which servers have increasing memory usage?',
    'Are there suspicious login attempts or audit events?',
    'Show critical incidents and root causes.',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <BotMessageSquare className="w-5 h-5 text-cyan-400" />
            Natural-Language Cloud Infrastructure Assistant
          </h2>
          <p className="text-xs text-slate-400">
            Local Ollama model responses grounded directly in your SQLite telemetry database.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
              ollamaStatus?.available
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            {ollamaStatus?.available ? 'Ollama Online' : 'Ollama Offline (Deterministic Fallback)'}
          </span>
        </div>
      </div>

      {/* Suggested Questions Pills */}
      <div className="flex flex-wrap gap-2 pt-1">
        {sampleQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-800 hover:border-slate-700 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Thread Messages */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-4 shadow-sm">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                msg.sender === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-cyan-400 border border-slate-700'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-2xl rounded-2xl p-3.5 text-xs ${
                msg.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-tr-none'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none space-y-2'
              }`}
            >
              <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
              {msg.modelUsed && (
                <div className="text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-800/80 pt-1.5 mt-2">
                  <span>Grounded in local SQLite</span>
                  <span className="font-mono">Engine: {msg.modelUsed}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-400">
              Querying local telemetry and formulating grounded response...
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Ask about CPU utilization, memory trends, or security events..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={chatMutation.isPending || !inputQuery.trim()}
          className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
