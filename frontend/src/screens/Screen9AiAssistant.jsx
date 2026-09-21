import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Screen9AiAssistant() {
  const { t } = useI18n();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">Home</Link>
          <span>/</span>
          <span className="text-emerald-400">AI Intelligence</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 9 · AI Environmental Intelligence
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Conversational Environmental Forensic Assistant
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

        {/* Ownership Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">🤖</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 5 Deliverable:</span> Screen 9 AI Chat interface, multilingual LLM grounding, and P1 contextual read-aloud TTS (using MYRAA as a technical reference) are owned by Anish in Phase 5 according to <code className="text-emerald-400">docs/06_IMPLEMENTATION_PLAN.md</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
