import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Screen5Prediction() {
  const { t } = useI18n();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">Home</Link>
          <span>/</span>
          <Link to="/investigate/Shivajinagar" className="hover:text-zinc-200">Investigation</Link>
          <span>/</span>
          <span className="text-emerald-400">Prediction</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 5 · Atmospheric Prediction
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Downwind Dispersion & AQI Trajectory Forecast
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Phase 1 Routing Skeleton
            </span>
            <span className="px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800/40 text-amber-400 font-mono">
              Phase 5 Milestone
            </span>
          </div>
        </div>

        {/* Phase 5 Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">📈</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 5 Deliverable:</span> Predictive dispersion cones, trajectory forecasts, and AI narrative projections will be delivered in Phase 5 according to <code className="text-emerald-400">docs/06_IMPLEMENTATION_PLAN.md</code>.
          </div>
        </div>

        {/* Forecast Sandbox Card */}
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Predictive Horizon Configuration
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="text-zinc-400 block">+1 Hour Ahead</span>
              <span className="text-white font-semibold text-base mt-1 block">AQI 325 (High Peak)</span>
              <span className="text-amber-400 text-[10px]">Active Industrial Shift</span>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="text-zinc-400 block">+3 Hours Ahead</span>
              <span className="text-white font-semibold text-base mt-1 block">AQI 290 (Poor)</span>
              <span className="text-emerald-400 text-[10px]">Thermal Inversion Breakup</span>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="text-zinc-400 block">+6 Hours Ahead</span>
              <span className="text-white font-semibold text-base mt-1 block">AQI 210 (Moderate-Poor)</span>
              <span className="text-zinc-400 text-[10px]">Evening Traffic Onset</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
