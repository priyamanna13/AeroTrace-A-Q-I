import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import AqiTrendChart from '../components/AqiTrendChart';

export default function Screen3StationIntelligence() {
  const { stationId = 'Shivajinagar' } = useParams();
  const { t } = useI18n();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">Home</Link>
          <span>/</span>
          <Link to="/national" className="hover:text-zinc-200">India</Link>
          <span>/</span>
          <Link to="/city/Pune" className="hover:text-zinc-200">Pune</Link>
          <span>/</span>
          <span className="text-emerald-400">{stationId}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 3 · Station Intelligence
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {stationId} Physical Monitoring Station
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/investigate/${stationId}`}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
            >
              Launch Forensic Plume (Screen 4) →
            </Link>
          </div>
        </div>

        {/* Phase 3 Assignment Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">📊</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 3 Deliverable:</span> Detailed pollutant breakdown charts (PM2.5, PM10, NO2, SO2, CO, O3) and historical trend analysis powered by ECharts will be implemented in Phase 3 according to <code className="text-emerald-400">docs/06_IMPLEMENTATION_PLAN.md</code>.
          </div>
        </div>

        {/* Station Metadata Card */}
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Station Verification & Identity
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-zinc-400 block">Network:</span>
              <span className="text-white font-semibold">CPCB CAAQMS</span>
            </div>
            <div>
              <span className="text-zinc-400 block">Entity Type:</span>
              <span className="text-emerald-400 font-semibold">verified_physical_station</span>
            </div>
            <div>
              <span className="text-zinc-400 block">Coordinates:</span>
              <span className="text-white">18.5308° N, 73.8553° E</span>
            </div>
            <div>
              <span className="text-zinc-400 block">Elevation:</span>
              <span className="text-white">560m ASL</span>
            </div>
          </div>
        </div>

        {/* ECharts Baseline Integration */}
        <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Telemetry Trend Visualization (ECharts Verified)
            </h2>
            <span className="text-[10px] font-mono text-emerald-400">echarts v6.1</span>
          </div>
          <AqiTrendChart title={`${stationId} · 24-Hour Diurnal AQI Trend`} />
        </div>
      </div>
    </div>
  );
}
