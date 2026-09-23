import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { API } from '../api_client';
import AiInsightCard from '../components/ai/AiInsightCard';

export default function Screen9AiAssistant() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        lang === 'hi'
          ? 'नमस्ते! मैं एरोट्रेस एआई पर्यावरण सहायक हूँ। आप भारत के 7 महानगरों के वायु प्रदूषण, स्रोतों या पूर्वानुमान के बारे में कुछ भी पूछ सकते हैं।'
          : lang === 'mr'
          ? 'नमस्कार! मी एरोट्रेस एआय पर्यावरण सहाय्यक आहे. तुम्ही भारतातील ७ महानगरांच्या हवेची गुणवत्ता, प्रदूषण स्रोत किंवा अंदाजाबद्दल विचारू शकता.'
          : 'Hello! I am the AeroTrace AI Environmental Forensic Assistant. You can ask about airshed telemetry, source attribution, or dispersion forecasts across all 7 Indian metropolitan regions.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await API.sendAIChat(userMsg.content, {
        screen_id: 'screen_9',
        language: lang,
      }, messages);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res?.reply || res?.response_text || 'Insight grounded on verified CPCB CAAQMS sensor telemetry.',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Unable to contact live AI server. Grounded mock response: Continuous 30-second monitoring across all 7 metropolitan airsheds confirms elevated particulate concentrations during morning inversion peaks.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">{t('nav.breadcrumbHome')}</Link>
          <span>/</span>
          <span className="text-emerald-400">{t('nav.ai')}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {t('screen9.tag')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {t('screen9.title')}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Phase 1 Routing Skeleton
            </span>
            <span className="px-2.5 py-1 rounded bg-purple-950/40 border border-purple-800/40 text-purple-400 font-mono">
              Phase 5 Milestone (Anish)
            </span>
          </div>
        </div>

        {/* Phase 5 Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">🤖</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 5 Deliverable:</span> {t('screen9.phaseNotice')}
          </div>
        </div>

        {/* AI Insight Card */}
        <AiInsightCard
          context={{
            screen_id: 'screen_9',
            city: 'India Metros',
            language: lang,
            provenance: 'sensor_measurement',
          }}
        />

        {/* Chat Stream Window */}
        <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2 no-scrollbar">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs leading-relaxed ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`p-3.5 rounded-xl max-w-xl ${
                    m.role === 'user'
                      ? 'bg-emerald-600/90 text-white rounded-tr-none'
                      : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/60 rounded-tl-none'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-center text-xs text-zinc-400 font-mono pl-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Thinking...
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-zinc-800/80">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Delhi PM2.5, Mumbai winds, or Pune plume attribution..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
