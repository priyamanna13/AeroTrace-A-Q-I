import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { API } from '../api_client';
import AiInsightCard from '../components/ai/AiInsightCard';

const CITIES = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Kolkata', 'Hyderabad', 'Chennai'];
const TIME_RANGES = ['24H', '7D', '30D'];

/** Severity color for AQI value (CPCB India scale). */
function aqiColor(aqi) {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#84cc16';
  if (aqi <= 200) return '#f59e0b';
  if (aqi <= 300) return '#f97316';
  if (aqi <= 400) return '#ef4444';
  return '#7f1d1d';
}

/** Arrow indicator for trend direction. */
function trendArrow(dir) {
  if (dir === 'improving') return { symbol: '↓', color: '#22c55e', label: 'Improving' };
  if (dir === 'worsening') return { symbol: '↑', color: '#ef4444', label: 'Worsening' };
  return { symbol: '→', color: '#a1a1aa', label: 'Stable' };
}

export default function Screen7Analytics() {
  const { t, lang } = useI18n();
  const [city, setCity] = useState('Pune');
  const [timeRange, setTimeRange] = useState('24H');
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      API.getCityAnalytics(city, timeRange),
      API.getCityAlerts(city),
    ]).then(([anRes, alRes]) => {
      if (!isMounted) return;
      if (anRes.status === 'fulfilled') {
        setAnalytics(anRes.value);
      } else {
        setError('Failed to load analytical telemetry.');
      }
      if (alRes.status === 'fulfilled') {
        setAlerts(Array.isArray(alRes.value) ? alRes.value : []);
      }
      setLoading(false);
    });

    return () => { isMounted = false; };
  }, [city, timeRange]);

  const trend = analytics?.trend;
  const diurnal = trend?.diurnal_patterns;
  const trendInfo = trendArrow(trend?.trend_direction);

  const aiContext = analytics
    ? {
        screen_id: 'screen_7_analytics',
        city: analytics.city,
        current_aqi: analytics.current_aqi,
        dominant_pollutant: analytics.dominant_pollutant,
        data_source: analytics.data_source,
        data_timestamp: analytics.data_timestamp,
        is_simulated: analytics.is_simulated,
        language: lang,
        analytics: {
          trend_direction: trend?.trend_direction,
          morning_peak_aqi: diurnal?.morning_peak_aqi,
          midday_dip_aqi: diurnal?.midday_dip_aqi,
          evening_peak_aqi: diurnal?.evening_peak_aqi,
          time_range: analytics.time_range,
        },
      }
    : { screen_id: 'screen_7_analytics', city, language: lang };

  // Severity badge for active alert count
  const severeCount = alerts.filter(a => a.severity === 'Severe Emergency').length;
  const warningCount = alerts.filter(a => a.severity === 'Warning').length;

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">{t('nav.breadcrumbHome')}</Link>
          <span>/</span>
          <span className="text-emerald-400">{t('nav.analytics')}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {t('screen7.tag')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {t('screen7.title')}
            </h1>
          </div>
          {/* Alert count badges */}
          {(severeCount > 0 || warningCount > 0) && (
            <Link to="/alerts" className="flex items-center gap-2 text-xs">
              {severeCount > 0 && (
                <span className="px-2.5 py-1 rounded bg-red-950/40 border border-red-800/40 text-red-400 font-mono font-bold animate-pulse">
                  🚨 {severeCount} Severe
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2.5 py-1 rounded bg-orange-950/40 border border-orange-800/40 text-orange-400 font-mono font-bold">
                  ⚠️ {warningCount} Warning
                </span>
              )}
            </Link>
          )}
        </div>

        {/* Selectors: City + Time Range */}
        <div className="flex flex-wrap items-center gap-3">
          {/* City selector */}
          <div className="flex gap-1.5 flex-wrap">
            {CITIES.map(c => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  city === c
                    ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-zinc-800" />

          {/* Time range selector */}
          <div className="flex gap-1.5">
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  timeRange === r
                    ? 'bg-amber-600/20 border border-amber-500/40 text-amber-400'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="p-8 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-400 font-mono">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin mr-2 align-middle" />
            Loading {city} analytics ({timeRange})…
          </div>
        )}

        {error && !loading && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400 font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Analytics Data */}
        {analytics && !loading && (
          <>
            {/* Overview Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Current AQI */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Current AQI</div>
                <div className="text-3xl font-bold" style={{ color: aqiColor(analytics.current_aqi) }}>
                  {Math.round(analytics.current_aqi)}
                </div>
                <div className="text-xs text-zinc-400 mt-1">{analytics.aqi_category}</div>
              </div>

              {/* Dominant Pollutant */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Dominant</div>
                <div className="text-2xl font-bold text-white">{analytics.dominant_pollutant}</div>
                <div className="text-xs text-zinc-400 mt-1">{analytics.data_source}</div>
              </div>

              {/* Trend Direction */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Trend ({timeRange})</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: trendInfo.color }}>{trendInfo.symbol}</span>
                  <span className="text-sm font-semibold" style={{ color: trendInfo.color }}>{trendInfo.label}</span>
                </div>
                {trend?.rate_of_change != null && (
                  <div className="text-xs text-zinc-400 mt-1 font-mono">
                    {trend.rate_of_change > 0 ? '+' : ''}{trend.rate_of_change.toFixed(1)} AQI/hr
                  </div>
                )}
              </div>

              {/* Anomalies */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Anomalies</div>
                {trend?.anomaly_flags?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {trend.anomaly_flags.map((flag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-amber-400 text-[10px] font-mono font-bold">
                        {flag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500 mt-1">None detected</div>
                )}
              </div>
            </div>

            {/* Diurnal Pattern Cards */}
            {diurnal && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                  Diurnal Physics Pattern — {analytics.city}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Morning Inversion Peak */}
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🌅</span>
                      <div>
                        <div className="text-xs font-bold text-orange-400">Morning Inversion Peak</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{diurnal.morning_peak_hour || '06:00–09:00'}</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: aqiColor(diurnal.morning_peak_aqi) }}>
                      {Math.round(diurnal.morning_peak_aqi)} AQI
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Nocturnal inversion traps pollutants near surface; broken by solar heating ~10 AM.
                    </div>
                  </div>

                  {/* Midday Convective Dip */}
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">☀️</span>
                      <div>
                        <div className="text-xs font-bold text-emerald-400">Midday Convective Dip</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{diurnal.midday_dip_hour || '12:00–15:00'}</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: aqiColor(diurnal.midday_dip_aqi) }}>
                      {Math.round(diurnal.midday_dip_aqi)} AQI
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Solar convection deepens PBL to ~2 km, diluting pollutant concentrations.
                    </div>
                  </div>

                  {/* Evening Peak */}
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🌆</span>
                      <div>
                        <div className="text-xs font-bold text-red-400">Evening Re-accumulation</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{diurnal.evening_peak_hour || '18:00–22:00'}</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: aqiColor(diurnal.evening_peak_aqi) }}>
                      {Math.round(diurnal.evening_peak_aqi)} AQI
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Evening traffic + cooling surface re-establishes shallow stable layer.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Script */}
            {analytics.voice_script && (
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">📢 Voice Briefing Script</div>
                <p className="text-xs text-zinc-300 leading-relaxed">{analytics.voice_script}</p>
              </div>
            )}

            {/* Trend Interpretation */}
            {trend?.interpretation && (
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">🔬 Trend Interpretation</div>
                <p className="text-xs text-zinc-300 leading-relaxed">{trend.interpretation}</p>
              </div>
            )}
          </>
        )}

        {/* AI Insight Card */}
        <AiInsightCard context={aiContext} />

        {/* Active Alerts Summary for this city */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                Active Alerts — {city}
              </h3>
              <Link to="/alerts" className="text-xs text-emerald-400 hover:text-emerald-300 font-mono">
                View All Alerts →
              </Link>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert, i) => {
                const sevColor = alert.severity === 'Severe Emergency' ? '#ef4444'
                  : alert.severity === 'Warning' ? '#f97316' : '#f59e0b';
                return (
                  <div key={alert.alert_id || i} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-start gap-3">
                    <span
                      className="mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: sevColor, boxShadow: `0 0 6px ${sevColor}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold" style={{ color: sevColor }}>
                        {alert.title?.[lang] || alert.title?.en || alert.severity}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                        {alert.message?.[lang] || alert.message?.en || ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Provenance */}
        {analytics && (
          <div className="text-[10px] text-zinc-600 font-mono text-right">
            Source: {analytics.data_source} · {analytics.data_timestamp}
            {analytics.is_simulated && ' · SIMULATED'}
          </div>
        )}
      </div>
    </div>
  );
}
