import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { API } from '../api_client';
import AiInsightCard from '../components/ai/AiInsightCard';

const CITIES = ['All', 'Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Kolkata', 'Hyderabad', 'Chennai'];
const SEVERITIES = ['All', 'Severe Emergency', 'Warning', 'Advisory'];

export default function Screen8Alerts() {
  const { t, lang } = useI18n();
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchPromise = selectedCity === 'All'
      ? API.getAllAlerts()
      : API.getCityAlerts(selectedCity);

    fetchPromise
      .then((data) => {
        if (!isMounted) return;
        setAlerts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to fetch live alerts:', err);
        setError('Live alerts endpoint currently unreachable. Showing local fallback telemetry.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCity]);

  // Filter alerts by severity
  const filteredAlerts = alerts.filter((alert) => {
    if (selectedSeverity === 'All') return true;
    return alert.severity === selectedSeverity;
  });

  // Severity metrics
  const severeCount = alerts.filter(a => a.severity === 'Severe Emergency').length;
  const warningCount = alerts.filter(a => a.severity === 'Warning').length;
  const advisoryCount = alerts.filter(a => a.severity === 'Advisory').length;

  const getSeverityStyle = (severity) => {
    if (severity === 'Severe Emergency') {
      return {
        badge: 'bg-red-950/60 border-red-700/60 text-red-300',
        dot: 'bg-red-500 shadow-[0_0_8px_#ef4444]',
        border: 'border-red-900/40 bg-red-950/10',
        accent: '#ef4444',
      };
    }
    if (severity === 'Warning') {
      return {
        badge: 'bg-orange-950/60 border-orange-700/60 text-orange-300',
        dot: 'bg-orange-500 shadow-[0_0_8px_#f97316]',
        border: 'border-orange-900/40 bg-orange-950/10',
        accent: '#f97316',
      };
    }
    return {
      badge: 'bg-amber-950/60 border-amber-700/60 text-amber-300',
      dot: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
      border: 'border-amber-900/40 bg-amber-950/10',
      accent: '#f59e0b',
    };
  };

  const aiContext = {
    screen_id: 'screen_8_alerts',
    city: selectedCity === 'All' ? 'National Metros' : selectedCity,
    current_aqi: alerts[0]?.current_aqi || 220,
    dominant_pollutant: alerts[0]?.pollutant || 'PM2.5',
    data_source: alerts[0]?.data_source || 'CPCB CAAQMS / Copernicus CAMS',
    data_timestamp: alerts[0]?.data_timestamp || new Date().toISOString(),
    is_simulated: alerts[0]?.is_simulated || false,
    language: lang,
  };

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">{t('nav.breadcrumbHome')}</Link>
          <span>/</span>
          <span className="text-emerald-400">{t('nav.alerts')}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Screen 8 · Public Health & Enforcement Intelligence
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Contextual Air Quality Alerts
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              7 Metros Real-time
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 font-mono">
              Phase 3 Live
            </span>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Total Active</div>
            <div className="text-2xl font-bold text-white mt-1">{alerts.length}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Across monitored airsheds</div>
          </div>
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40">
            <div className="text-[10px] font-mono uppercase tracking-widest text-red-400">Severe Emergency</div>
            <div className="text-2xl font-bold text-red-300 mt-1">{severeCount}</div>
            <div className="text-[11px] text-red-400/80 mt-0.5">AQI &gt; 400 or acute PM2.5</div>
          </div>
          <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-900/40">
            <div className="text-[10px] font-mono uppercase tracking-widest text-orange-400">Warnings</div>
            <div className="text-2xl font-bold text-orange-300 mt-1">{warningCount}</div>
            <div className="text-[11px] text-orange-400/80 mt-0.5">AQI 201–400 (Poor/V.Poor)</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40">
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Advisories</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{advisoryCount}</div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">AQI 101–200 (Moderate)</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800">
          {/* City Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-zinc-500 mr-1">City:</span>
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCity(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  selectedCity === c
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-zinc-500 mr-1">Severity:</span>
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSeverity(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  selectedSeverity === s
                    ? 'bg-zinc-700 text-white font-bold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* AI Insight Card for Alerts Overview */}
        <AiInsightCard context={aiContext} />

        {/* Alerts List */}
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            Evaluating atmospheric thresholds across CAAQMS stations...
          </div>
        ) : error && alerts.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-amber-400">
            {error}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400 font-mono">
            ✅ No active environmental alerts for selected criteria ({selectedCity}, {selectedSeverity}). Air quality is within standard baseline.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map((alert, idx) => {
              const style = getSeverityStyle(alert.severity);
              const titleText = alert.title?.[lang] || alert.title?.en || alert.severity;
              const msgText = alert.message?.[lang] || alert.message?.en || '';
              const healthRecs = alert.health_recommendations?.[lang] || alert.health_recommendations?.en || [];
              const civicMeasures = alert.actionable_measures?.[lang] || alert.actionable_measures?.en || [];

              return (
                <div
                  key={alert.alert_id || idx}
                  className={`p-5 rounded-xl border ${style.border} space-y-4 transition-all hover:border-zinc-700`}
                >
                  {/* Top Meta Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider border ${style.badge}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-zinc-300 font-semibold font-mono">
                        {alert.station ? `${alert.station}, ${alert.city}` : alert.city}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                      <span>Trigger: <strong className="text-white">{alert.pollutant.toUpperCase()} = {Math.round(alert.trigger_value)}</strong> (Threshold: {alert.threshold_value})</span>
                      <span>AQI: <strong style={{ color: style.accent }}>{Math.round(alert.current_aqi)}</strong></span>
                    </div>
                  </div>

                  {/* Headline & Narrative */}
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">{titleText}</h2>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{msgText}</p>
                  </div>

                  {/* Health Advice & Civic Measures Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Citizen Health Advice */}
                    {healthRecs.length > 0 && (
                      <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
                        <div className="text-[11px] font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🛡️</span> Citizen Health Advisory
                        </div>
                        <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                          {healthRecs.map((rec, i) => (
                            <li key={i} className="leading-snug">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Civic & Enforcement Measures */}
                    {civicMeasures.length > 0 && (
                      <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
                        <div className="text-[11px] font-bold font-mono text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🏛️</span> Municipal Actionable Measures
                        </div>
                        <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                          {civicMeasures.map((measure, i) => (
                            <li key={i} className="leading-snug">{measure}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Bottom Footer: Provenance & Deep Links */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500 font-mono">
                    <div>
                      Source: {alert.data_source} · Timestamp: {alert.data_timestamp}
                      {alert.is_simulated && ' · (SIMULATED DATA)'}
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        to="/analytics"
                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        View Trends →
                      </Link>
                      <Link
                        to="/investigate"
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        Source Attribution Plume →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
