import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Screen6Intervention() {
  const { t } = useI18n();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">Home</Link>
          <span>/</span>
          <Link to="/prediction" className="hover:text-zinc-200">Prediction</Link>
          <span>/</span>
          <span className="text-emerald-400">Intervention Sandbox</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 6 · Impact & Policy Intervention
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Counterfactual Policy & Intervention Simulator
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Phase 1 Routing Skeleton
            </span>
            <span className="px-2.5 py-1 rounded bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 font-mono">
              Phase 5 Milestone
            </span>
          </div>
        </div>

        {/* Phase 5 Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">🛡️</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 5 Deliverable:</span> Interactive municipal policy levers (smog guns, traffic diversions, construction halts) with counterfactual AQI reduction delta curves will be implemented in Phase 5 according to <code className="text-emerald-400">docs/06_IMPLEMENTATION_PLAN.md</code>.
          </div>
        </div>

        {/* Levers Prototype Card */}
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Sample Municipal Action Levers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="font-semibold text-white block">Anti-Smog Water Sprinklers</span>
              <span className="text-zinc-400 mt-1 block">Deploy high-pressure mist cannons along Hinjewadi Phase 3.</span>
              <span className="text-emerald-400 font-mono text-[11px] mt-2 block font-semibold">Est. Δ -35 AQI (PM10)</span>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="font-semibold text-white block">Heavy Vehicle Diversion</span>
              <span className="text-zinc-400 mt-1 block">Reroute diesel trucks around the expressway entry corridor.</span>
              <span className="text-emerald-400 font-mono text-[11px] mt-2 block font-semibold">Est. Δ -22 AQI (NO2)</span>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="font-semibold text-white block">Construction Pause</span>
              <span className="text-zinc-400 mt-1 block">Issue stop-work notice for open excavation clusters.</span>
              <span className="text-emerald-400 font-mono text-[11px] mt-2 block font-semibold">Est. Δ -48 AQI (PM10)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
