import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Screen2CityIntelligence() {
  const { cityName = 'Pune' } = useParams();
  const { t } = useI18n();

  const puneStations = [
    { id: 'Shivajinagar', name: 'Shivajinagar', aqi: 310, dominant: 'PM10', status: 'Very Poor', isSpike: true },
    { id: 'Swargate', name: 'Swargate', aqi: 185, dominant: 'NO2', status: 'Moderate', isSpike: false },
    { id: 'Hadapsar', name: 'Hadapsar', aqi: 245, dominant: 'SO2', status: 'Poor', isSpike: false },
    { id: 'Kothrud', name: 'Kothrud', aqi: 190, dominant: 'PM2.5', status: 'Moderate', isSpike: false },
  ];

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">Home</Link>
          <span>/</span>
          <Link to="/national" className="hover:text-zinc-200">India</Link>
          <span>/</span>
          <span className="text-emerald-400">{cityName}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 2 · City Intelligence
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {cityName} Metropolitan Airshed
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

        {/* Station Integrity Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">🛡️</span>
          <div>
            <span className="font-semibold text-zinc-200">Station Integrity Rule:</span> Only verified physical CAAQMS monitoring stations are plotted as station pins. Atmospheric model estimates are segregated into regional background overlays.
          </div>
        </div>

        {/* Stations List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Verified Monitoring Stations ({cityName})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {puneStations.map((station) => (
              <div
                key={station.id}
                className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-white">{station.name}</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-red-950/30 text-red-400 border border-red-800/30">
                      AQI {station.aqi}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-400 flex items-center gap-3">
                    <span>Status: <strong className="text-zinc-200">{station.status}</strong></span>
                    <span>Dominant: <strong className="text-zinc-200">{station.dominant}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800/60">
                  <Link
                    to={`/station/${station.id}`}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                  >
                    Station Detail (Screen 3)
                  </Link>
                  <Link
                    to={`/investigate/${station.id}`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                  >
                    Forensic Investigation (Screen 4)
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
