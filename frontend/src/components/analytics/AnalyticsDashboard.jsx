import React, { useState, useEffect } from 'react';
import { API } from '../../api_client';
import AiInsightCard from '../ai/AiInsightCard';

/**
 * AnalyticsDashboard — Screen 7 AI Environmental Intelligence & Historical Trends
 * (Anish — Intelligence Subsystem | AeroTrace NGEC 2026)
 *
 * Implements:
 *   - Scope selector (Metropolitan City selection across all 7 metros).
 *   - Time range selector (24H / 7D / 30D).
 *   - Physical Diurnal Pattern cards (Morning Inversion Peak, Midday Convective Dip, Evening Peak).
 *   - Rate-of-change trend indicator and anomaly badges.
 *   - Contextual public health & civic alert status for the city.
 *   - Grounded AiInsightCard with seamless voiceService read-aloud integration.
 */
export default function AnalyticsDashboard({ initialCity = 'Pune', onNavigate }) {
  const [city, setCity] = useState(initialCity);
  const [timeRange, setTimeRange] = useState('24H');
  const [lang, setLang] = useState('en');
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const CITIES = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Kolkata', 'Hyderabad', 'Chennai'];

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
        setError('Failed to load analytical telemetry. Please verify connection.');
      }

      if (alRes.status === 'fulfilled') {
        setAlerts(alRes.value || []);
      } else {
        setAlerts([]);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [city, timeRange]);

  // Derive AI Context for AiInsightCard
  const aiContext = analytics
    ? {
        screen_id: 'screen_7_analytics',
        city: analytics.city,
        current_aqi: analytics.current_aqi,
        dominant_pollutant: analytics.dominant_pollutant,
        data_source: analytics.data_source,
        data_timestamp: analytics.data_timestamp,
        is_simulated: analytics.is_simulated,
        is_stale: analytics.is_stale,
        language: lang,
        analytics: {
          trend_direction: analytics.trend?.trend_direction,
          morning_peak_aqi: analytics.trend?.diurnal_patterns?.morning_peak_aqi,
          midday_dip_aqi: analytics.trend?.diurnal_patterns?.midday_dip_aqi,
          evening_peak_aqi: analytics.trend?.diurnal_patterns?.evening_peak_aqi,
          time_range: analytics.time_range,
        },
      }
    : null;

  return (
    <div style={{
      width: '100%',
      minHeight: '100%',
      background: '#08080a',
      color: '#f4f4f5',
      fontFamily: "'Inter', sans-serif",
      padding: '24px 32px',
      overflowY: 'auto',
      boxSizing: 'border-box',
    }}>
      {/* ── HEADER & SCOPE CONTROLS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Environmental Intelligence & Analytics
            </h1>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '2px 8px',
              borderRadius: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Screen 7
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4, margin: 0 }}>
            Diurnal atmospheric physics, longitudinal trends, and multi-tier source telemetry.
          </p>
        </div>

        {/* Global Controls: City, Time Range, Locale */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* City Selector */}
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{
              background: 'rgba(18, 18, 24, 0.95)',
              color: '#f4f4f5',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Time Range Selector */}
          <div style={{
            display: 'flex',
            background: 'rgba(18, 18, 24, 0.95)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: 2,
          }}>
            {['24H', '7D', '30D'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  background: timeRange === range ? 'rgba(251, 146, 60, 0.2)' : 'transparent',
                  color: timeRange === range ? '#fb923c' : '#a1a1aa',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Language Toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(18, 18, 24, 0.95)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: 2,
          }}>
            {[
              { code: 'en', label: 'EN' },
              { code: 'hi', label: 'हि' },
              { code: 'mr', label: 'म' },
            ].map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  background: lang === code ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                  color: lang === code ? '#60a5fa' : '#71717a',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTEXTUAL ALERT NOTIFICATION ── */}
      {alerts.length > 0 && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          background: alerts[0].severity === 'Severe Emergency'
            ? 'rgba(239, 68, 68, 0.12)'
            : alerts[0].severity === 'Warning'
            ? 'rgba(245, 158, 11, 0.12)'
            : 'rgba(59, 130, 246, 0.12)',
          border: `1px solid ${
            alerts[0].severity === 'Severe Emergency'
              ? 'rgba(239, 68, 68, 0.35)'
              : alerts[0].severity === 'Warning'
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(59, 130, 246, 0.35)'
          }`,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: alerts[0].severity === 'Severe Emergency' ? '#f87171' : alerts[0].severity === 'Warning' ? '#fbbf24' : '#60a5fa',
              marginBottom: 4,
            }}>
              ⚠️ {alerts[0].severity} &middot; {alerts[0].title[lang] || alerts[0].title.en}
            </div>
            <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.4 }}>
              {alerts[0].message[lang] || alerts[0].message.en}
            </div>
            {alerts[0].health_recommendations?.[lang]?.[0] && (
              <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>
                <strong>Health Advice:</strong> {alerts[0].health_recommendations[lang][0]}
              </div>
            )}
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate(alerts[0].deep_link)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f4f4f5',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                alignSelf: 'center',
              }}
            >
              Investigate &rarr;
            </button>
          )}
        </div>
      )}

      {/* ── AI INSIGHT CARD (WITH CONTEXTUAL VOICE READ-ALOUD) ── */}
      {aiContext && (
        <div style={{ marginBottom: 24 }}>
          <AiInsightCard
            context={aiContext}
            onAskAeroTrace={() => {
              if (onNavigate) onNavigate({ screen: 'screen_9_chat', city, context: aiContext });
            }}
          />
        </div>
      )}

      {/* ── DIURNAL PATTERN BREAKDOWN CARDS ── */}
      {analytics?.trend?.diurnal_patterns && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#a1a1aa',
            marginBottom: 12,
          }}>
            Atmospheric Diurnal Physics Cycle
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {/* Morning Inversion Peak */}
            <div style={{
              background: 'rgba(18, 18, 24, 0.85)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', letterSpacing: '0.05em' }}>
                  🌅 MORNING INVERSION PEAK
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#f87171' }}>
                  {analytics.trend.diurnal_patterns.morning_peak_aqi} AQI
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                Window: {analytics.trend.diurnal_patterns.morning_peak_window}
              </div>
              <p style={{ fontSize: 12, color: '#d4d4d8', marginTop: 8, lineHeight: 1.4 }}>
                {analytics.trend.diurnal_patterns.morning_mechanism}
              </p>
            </div>

            {/* Midday Convective Dip */}
            <div style={{
              background: 'rgba(18, 18, 24, 0.85)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#4ade80', letterSpacing: '0.05em' }}>
                  ☀️ CONVECTIVE MIXING DIP
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#4ade80' }}>
                  {analytics.trend.diurnal_patterns.midday_dip_aqi} AQI
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                Window: {analytics.trend.diurnal_patterns.midday_dip_window}
              </div>
              <p style={{ fontSize: 12, color: '#d4d4d8', marginTop: 8, lineHeight: 1.4 }}>
                {analytics.trend.diurnal_patterns.midday_mechanism}
              </p>
            </div>

            {/* Evening Peak */}
            <div style={{
              background: 'rgba(18, 18, 24, 0.85)',
              border: '1px solid rgba(251, 146, 60, 0.25)',
              borderRadius: 12,
              padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fb923c', letterSpacing: '0.05em' }}>
                  🌆 EVENING ACCUMULATION
                </span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#fb923c' }}>
                  {analytics.trend.diurnal_patterns.evening_peak_aqi} AQI
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                Window: {analytics.trend.diurnal_patterns.evening_peak_window}
              </div>
              <p style={{ fontSize: 12, color: '#d4d4d8', marginTop: 8, lineHeight: 1.4 }}>
                {analytics.trend.diurnal_patterns.evening_mechanism}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TIME-SERIES TREND BARS ── */}
      {analytics?.data_points && (
        <div style={{
          background: 'rgba(14, 14, 18, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f4f4f5' }}>
                Longitudinal Air Quality Trend ({timeRange})
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                Trajectory: <strong style={{ color: '#fb923c' }}>{analytics.trend?.trend_direction?.toUpperCase()}</strong> &middot; Source: {analytics.data_source}
              </div>
            </div>
            {analytics.anomalies?.length > 0 && (
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                padding: '4px 10px',
                borderRadius: 8,
              }}>
                ⚡ {analytics.anomalies.length} Rate-of-Change Anomalies
              </div>
            )}
          </div>

          {/* Render bar sparkline */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            height: 120,
            paddingTop: 16,
            overflowX: 'auto',
          }}>
            {analytics.data_points.map((pt, idx) => {
              const maxVal = Math.max(...analytics.data_points.map((p) => p.aqi), 300);
              const heightPct = Math.min(100, Math.max(12, (pt.aqi / maxVal) * 100));
              const barColor =
                pt.aqi > 300
                  ? '#ef4444'
                  : pt.aqi > 200
                  ? '#f97316'
                  : pt.aqi > 100
                  ? '#eab308'
                  : '#22c55e';

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    minWidth: timeRange === '24H' ? 24 : 36,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title={`${pt.label}: ${pt.aqi} AQI (${pt.category})`}
                >
                  <div style={{ fontSize: 9, color: '#71717a', fontFamily: 'monospace' }}>
                    {Math.round(pt.aqi)}
                  </div>
                  <div style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    background: barColor,
                    borderRadius: '4px 4px 0 0',
                    opacity: 0.85,
                    transition: 'height 0.3s ease',
                  }} />
                  <div style={{ fontSize: 9, color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                    {pt.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KEY SCIENTIFIC FINDINGS ── */}
      {analytics?.trend?.key_findings && (
        <div style={{
          background: 'rgba(18, 18, 24, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#e4e4e7', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            🔬 Atmospheric Analytical Observations
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
            {analytics.trend.key_findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
