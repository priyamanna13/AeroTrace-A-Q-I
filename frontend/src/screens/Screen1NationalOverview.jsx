import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Screen1NationalOverview() {
  const { t } = useI18n();

  const cities = [
    { name: 'Pune', aqi: 310, status: 'Very Poor', stations: 4, dominant: 'PM10' },
    { name: 'Mumbai', aqi: 168, status: 'Moderate', stations: 8, dominant: 'PM2.5' },
    { name: 'Delhi', aqi: 382, status: 'Very Poor', stations: 40, dominant: 'PM2.5' },
    { name: 'Bengaluru', aqi: 74, status: 'Satisfactory', stations: 10, dominant: 'PM10' },
    { name: 'Kolkata', aqi: 215, status: 'Poor', stations: 7, dominant: 'PM2.5' },
    { name: 'Hyderabad', aqi: 122, status: 'Moderate', stations: 6, dominant: 'PM10' },
    { name: 'Chennai', aqi: 88, status: 'Satisfactory', stations: 5, dominant: 'PM2.5' },
  ];

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
    if (aqi <= 100) return 'text-lime-400 border-lime-500/30 bg-lime-950/20';
    if (aqi <= 200) return 'text-amber-400 border-amber-500/30 bg-amber-950/20';
    if (aqi <= 300) return 'text-orange-400 border-orange-500/30 bg-orange-950/20';
    if (aqi <= 400) return 'text-red-400 border-red-500/30 bg-red-950/20';
    return 'text-purple-400 border-purple-500/30 bg-purple-950/20';
  };

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 1 · Macro Airshed Surveillance
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              National Air Quality Overview
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Phase 1 Routing Skeleton
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 font-mono">
              30s Cadence
            </span>
          </div>
        </div>

        {/* Phase 2 Delivery Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">🗺️</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 2 Deliverable:</span> Full interactive Leaflet India SVG map with AQI-severity-colored city pins and continuous spatial zoom will be delivered in Phase 2 according to <code className="text-emerald-400">docs/06_IMPLEMENTATION_PLAN.md</code>.
          </div>
        </div>

        {/* 7 Target Cities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
          {cities.map((city) => (
            <Link
              key={city.name}
              to={`/city/${city.name}`}
              className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/30 transition-all block group"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                  {city.name}
                </span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${getAqiColor(city.aqi)}`}>
                  AQI {city.aqi}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                <span>{city.status}</span>
                <span className="font-mono text-zinc-400">{city.stations} Physical Stations</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 font-mono">
                Dominant: <span className="text-zinc-300">{city.dominant}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
