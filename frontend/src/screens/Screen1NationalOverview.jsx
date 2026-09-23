import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { API } from '../api_client';
import AiInsightCard from '../components/ai/AiInsightCard';

export default function Screen1NationalOverview() {
  const { t, lang } = useI18n();
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    API.getCities()
      .then((data) => {
        if (isMounted) {
          setCities(data || []);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[Screen1] Failed to fetch cities:', err);
          setError(err.message || t('screen1.errorCities'));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
    if (aqi <= 100) return 'text-lime-400 border-lime-500/30 bg-lime-950/20';
    if (aqi <= 200) return 'text-amber-400 border-amber-500/30 bg-amber-950/20';
    if (aqi <= 300) return 'text-orange-400 border-orange-500/30 bg-orange-950/20';
    if (aqi <= 400) return 'text-red-400 border-red-500/30 bg-red-950/20';
    return 'text-purple-400 border-purple-500/30 bg-purple-950/20';
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
          <span className="text-emerald-400">{t('nav.breadcrumbIndia')}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {t('screen1.tag')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {t('screen1.title')}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Phase 1 Contract Synced
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t('common.refreshRate')}
            </span>
          </div>
        </div>

        {/* Phase 2 Delivery Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">🗺️</span>
          <div>
            <span className="font-semibold text-zinc-200">{t('screen1.phaseNoticeTitle')}</span> {t('screen1.phaseNoticeDesc')}
          </div>
        </div>

        {/* National AI Insight Card */}
        <AiInsightCard
          context={{
            screen_id: 'screen_1',
            national_overview: true,
            city: 'India Metros',
            station_count: cities.length,
            language: lang,
            provenance: 'sensor_measurement',
          }}
        />

        {/* City Airshed Grid */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              {t('screen1.allCities')} ({cities.length})
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              Contract: <code className="text-emerald-400">GET /api/v1/cities</code>
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800 rounded-xl space-y-3">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-mono text-zinc-400">{t('screen1.loadingCities')}</div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-300 space-y-2">
              <div className="font-semibold">{t('common.error')}</div>
              <div>{error}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cities.map((city) => (
                <Link
                  key={city.name}
                  to={`/city/${city.name}`}
                  className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/30 transition-all block group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {city.name}
                      </span>
                      <span className="block text-[11px] text-zinc-400">{city.state}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs border ${getAqiColor(city.current_aqi)}`}>
                      AQI {Math.round(city.current_aqi)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>{getCategoryLabel(city.aqi_category)}</span>
                    <span className="font-mono text-zinc-300">{city.station_count} {t('common.stationCount')}</span>
                  </div>

                  <div className="mt-2 text-[11px] text-zinc-400 font-mono flex items-center justify-between">
                    <span>{t('common.dominant')}: <strong className="text-zinc-200">{city.dominant_pollutant}</strong></span>
                    {city.is_simulated ? (
                      <span className="text-amber-400 text-[9px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                        {t('common.simulatedNotice').split('—')[0].trim()}
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-[9px] font-mono">Verified</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
