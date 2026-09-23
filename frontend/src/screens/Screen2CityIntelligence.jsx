import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { API } from '../api_client';
import AiInsightCard from '../components/ai/AiInsightCard';

export default function Screen2CityIntelligence() {
  const { cityName = 'Pune' } = useParams();
  const { t, lang } = useI18n();

  const [stations, setStations] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      API.getCityStations(cityName),
      API.getCityOverview(cityName),
    ])
      .then(([stationsData, overviewData]) => {
        if (isMounted) {
          setStations(stationsData || []);
          setOverview(overviewData || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(`[Screen2] Failed to fetch data for ${cityName}:`, err);
          setError(err.message || t('screen2.errorStations'));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cityName, t]);

  const getAqiBadgeColor = (aqi) => {
    if (aqi <= 50) return 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40';
    if (aqi <= 100) return 'text-lime-400 bg-lime-950/30 border-lime-800/40';
    if (aqi <= 200) return 'text-amber-400 bg-amber-950/30 border-amber-800/40';
    if (aqi <= 300) return 'text-orange-400 bg-orange-950/30 border-orange-800/40';
    if (aqi <= 400) return 'text-red-400 bg-red-950/30 border-red-800/40';
    return 'text-purple-400 bg-purple-950/30 border-purple-800/40';
  };

  const getCategoryLabel = (cat) => {
    return t(`common.categories.${cat}`, cat);
  };

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">{t('nav.breadcrumbHome')}</Link>
          <span>/</span>
          <Link to="/national" className="hover:text-zinc-200">{t('nav.breadcrumbIndia')}</Link>
          <span>/</span>
          <span className="text-emerald-400 font-semibold">{cityName}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {t('screen2.tag')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {cityName} {t('screen2.titleSuffix')}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Contract: /cities/{cityName}/stations
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t('common.refreshRate')}
            </span>
          </div>
        </div>

        {/* Station Integrity Rule Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">🛡️</span>
          <div>
            <span className="font-semibold text-zinc-200">{t('screen2.integrityTitle')}</span> {t('screen2.integrityDesc')}
          </div>
        </div>

        {/* City Summary Metrics Overview */}
        {overview && (
          <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-zinc-400 block">{t('screen2.overviewAqi')}</span>
              <span className="text-2xl font-bold text-white mt-1 block">
                {Math.round(overview.current_aqi)}
              </span>
              <span className="text-[11px] text-amber-400 font-semibold">
                {getCategoryLabel(overview.aqi_category)}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block">{t('screen2.overviewDominant')}</span>
              <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                {overview.dominant_pollutant}
              </span>
              <span className="text-[11px] text-zinc-400">
                PM2.5: {overview.pm25} | PM10: {overview.pm10}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block">{t('screen2.overviewStations')}</span>
              <span className="text-2xl font-bold text-white mt-1 block">
                {overview.station_count || stations.length}
              </span>
              <span className="text-[11px] text-zinc-400 font-sans">
                {t('common.verifiedPhysicalStation')}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block">{t('common.source')}</span>
              <span className="text-xs font-semibold text-zinc-200 mt-1.5 block truncate">
                {overview.data_source}
              </span>
              <span className="text-[10px] text-zinc-400 block mt-1">
                {overview.data_timestamp ? new Date(overview.data_timestamp).toLocaleTimeString() : 'Live'}
              </span>
            </div>
          </div>
        )}

        {/* AI Insight Card for City */}
        <AiInsightCard
          context={{
            screen_id: 'screen_2',
            city: cityName,
            current_aqi: overview?.current_aqi || 150,
            dominant_pollutant: overview?.dominant_pollutant || 'PM2.5',
            station_count: stations.length,
            language: lang,
            provenance: overview?.is_simulated ? 'simulation' : 'sensor_measurement',
          }}
        />

        {/* Verified Stations List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              {t('screen2.verifiedStations')} ({cityName})
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              Total: {stations.length} CAAQMS
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800 rounded-xl space-y-3">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-mono text-zinc-400">
                {t('screen2.loadingStations')} {cityName}...
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300 space-y-2">
              <div className="font-semibold">{t('common.error')}</div>
              <div>{error}</div>
            </div>
          ) : stations.length === 0 ? (
            <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800 rounded-xl text-xs text-zinc-400">
              {t('screen2.noStations')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stations.map((station) => (
                <div
                  key={station.station_id || station.name}
                  className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-600 transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base font-bold text-white">{station.name}</span>
                        <span className="block text-[10px] font-mono text-zinc-400 mt-0.5">
                          ID: {station.station_id || 'CAAQMS'} · {station.network || 'CPCB_CAAQMS'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${getAqiBadgeColor(station.current_aqi)}`}>
                        AQI {Math.round(station.current_aqi)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400 font-mono bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60">
                      <div>
                        {t('common.status')}: <strong className="text-zinc-200">{getCategoryLabel(station.aqi_category)}</strong>
                      </div>
                      <div>
                        {t('common.dominant')}: <strong className="text-zinc-200">{station.dominant_pollutant}</strong>
                      </div>
                      <div>
                        {t('common.coordinates')}: <span className="text-zinc-300">{station.coordinates?.[1]?.toFixed(4)}°, {station.coordinates?.[0]?.toFixed(4)}°</span>
                      </div>
                      <div>
                        {t('common.elevation')}: <span className="text-zinc-300">{station.elevation_m}m</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/60">
                    <Link
                      to={`/station/${encodeURIComponent(station.name)}?city=${encodeURIComponent(cityName)}`}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                    >
                      {t('screen2.btnStationDetail')}
                    </Link>
                    <Link
                      to={`/investigate/${encodeURIComponent(station.name)}?city=${encodeURIComponent(cityName)}`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
                    >
                      {t('screen2.btnForensic')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
