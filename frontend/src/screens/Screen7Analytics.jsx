import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Screen7Analytics() {
  const { t } = useI18n();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">Home</Link>
          <span>/</span>
          <span className="text-emerald-400">Analytics</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 7 · Environmental Analytics & Trends
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Historical Patterns & Multi-Airshed Analytics
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Phase 1 Routing Skeleton
            </span>
            <span className="px-2.5 py-1 rounded bg-indigo-950/40 border border-indigo-800/40 text-indigo-400 font-mono">
              Phase 3 Milestone (Anish & Priya)
            </span>
          </div>
        </div>

        {/* Ownership Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">📊</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 3 Deliverable:</span> Screen 7 Analytics UI and alert correlation engines are owned by Anish in Phase 3, with ECharts trend visualizations integrated by Priya according to <code className="text-emerald-400">docs/06_IMPLEMENTATION_PLAN.md</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
