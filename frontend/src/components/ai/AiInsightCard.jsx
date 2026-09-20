import React, { useState, useEffect } from 'react';
import { API } from '../../api_client';
import { globalVoice } from '../../utils/voice';

/**
 * AiInsightCard — Contextual AI Environmental Intelligence Summary Card
 * (Anish — Intelligence Subsystem)
 * 
 * Props:
 *   - context: AIContext object (city, station, pollutant, screen_id, provenance, etc.)
 *   - onAskAeroTrace: optional callback when user clicks "Ask AeroTrace →"
 */
export default function AiInsightCard({ context, onAskAeroTrace }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    globalVoice.onStateChange = (state) => setIsSpeaking(state);
    return () => {
      globalVoice.stop();
    };
  }, []);

  useEffect(() => {
    if (!context) return;
    setLoading(true);
    setError(null);

    API.getAIInsight(context)
      .then((data) => {
        setInsight(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to fetch AI insight, using fallback:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [
    context?.city,
    context?.station,
    context?.pollutant,
    context?.current_aqi,
    context?.language,
    context?.screen_id,
  ]);

  const handleToggleVoice = () => {
    if (isSpeaking) {
      globalVoice.stop();
    } else if (insight?.response_text) {
      globalVoice.speak(insight.response_text, context?.language || 'en');
    }
  };

  // Helper for provenance styling
  const getProvenanceBadge = () => {
    const prov = insight?.provenance || context?.provenance;
    if (context?.is_simulated || prov === 'simulation') {
      return {
        label: 'SIMULATED',
        color: '#f87171',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.3)',
      };
    }
    if (prov === 'model_estimate') {
      return {
        label: 'MODEL ESTIMATE',
        color: '#60a5fa',
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.3)',
      };
    }
    if (prov === 'forecast') {
      return {
        label: 'FORECAST',
        color: '#c084fc',
        bg: 'rgba(168, 85, 247, 0.12)',
        border: 'rgba(168, 85, 247, 0.3)',
      };
    }
    return {
      label: 'SENSOR MEASUREMENT',
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.12)',
      border: 'rgba(52, 211, 153, 0.3)',
    };
  };

  const badge = getProvenanceBadge();

  return (
    <div
      style={{
        background: 'rgba(18, 18, 24, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '16px 20px',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.36)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(to right, #38bdf8, #818cf8, transparent)',
        }}
      />

      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 8px #38bdf8',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#e2e8f0',
              fontFamily: 'monospace',
            }}
          >
            AI Environmental Intelligence
          </span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '4px',
              color: badge.color,
              background: badge.bg,
              border: `1px solid ${badge.border}`,
              letterSpacing: '0.06em',
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* Voice Trigger Button */}
        <button
          onClick={handleToggleVoice}
          disabled={loading || !insight?.response_text}
          style={{
            background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: `1px solid ${isSpeaking ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
            borderRadius: '8px',
            color: isSpeaking ? '#f87171' : '#cbd5e1',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          <span>{isSpeaking ? '⏹' : '🔊'}</span>
          <span>
            {isSpeaking
              ? (context?.language === 'hi' ? 'रोकें' : context?.language === 'mr' ? 'थांबवा' : 'Stop')
              : (context?.language === 'hi' ? 'सुनें' : context?.language === 'mr' ? 'ऐका' : 'Listen')}
          </span>
        </button>
      </div>

      {/* Body Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
          <div style={{ height: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '92%' }} />
          <div style={{ height: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '78%' }} />
          <div style={{ height: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '60%' }} />
        </div>
      ) : error ? (
        <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>
          Unable to generate contextual insight. {error}
        </p>
      ) : (
        <p
          style={{
            fontSize: '13px',
            lineHeight: 1.65,
            color: '#cbd5e1',
            margin: 0,
            fontWeight: 400,
          }}
        >
          {insight?.response_text}
        </p>
      )}

      {/* Grounding & Provenance Note */}
      {insight?.confidence_note && !loading && (
        <div
          style={{
            fontSize: '10px',
            color: '#64748b',
            fontFamily: 'monospace',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            paddingTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span>ℹ️ {insight.confidence_note}</span>
          {onAskAeroTrace && (
            <button
              onClick={() => onAskAeroTrace(context)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Ask AeroTrace →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
