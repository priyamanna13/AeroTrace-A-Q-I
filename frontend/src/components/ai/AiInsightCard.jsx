import React, { useState, useEffect } from 'react';
import { API } from '../../api_client';
import { voiceService } from '../../services/voiceService';

/**
 * AiInsightCard — Contextual AI Environmental Intelligence Summary Card
 * (Anish — Intelligence Subsystem | AeroTrace NGEC 2026)
 * 
 * Implements P1 Contextual Voice integration with 5-state lifecycle:
 *   - 'idle': Speaker icon 🔊 (Listen)
 *   - 'loading': Buffering / spinner icon ⏳ (Loading...)
 *   - 'playing': Active animated stop icon ⏹ (Stop)
 *   - 'stopped': Resets to 'idle'
 *   - 'failed': Warning icon ⚠️ with inline "Retry" button (Text remains 100% visible)
 * 
 * Props:
 *   - context: AIContext object (city, station, pollutant, screen_id, provenance, etc.)
 *   - onAskAeroTrace: optional callback when user clicks "Ask AeroTrace →"
 */
export default function AiInsightCard({ context, onAskAeroTrace }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceError, setVoiceError] = useState(null);

  // Subscribe to voiceService state changes
  useEffect(() => {
    const unsubscribe = voiceService.subscribe((state, err) => {
      setVoiceState(state);
      setVoiceError(err ? (err.message || 'Voice playback failed') : null);
    });

    return () => {
      voiceService.stop();
      unsubscribe();
    };
  }, []);

  // LANGUAGE-SWITCH HYGIENE: when the user switches language mid-playback,
  // immediately stop any in-flight voice and reset the local state to idle so
  // audio in the previous language never continues under the new UI language.
  useEffect(() => {
    voiceService.stop();
    setVoiceState('idle');
    setVoiceError(null);
  }, [context?.language]);

  // Fetch contextual insight on context change
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
    if (voiceState === 'playing' || voiceState === 'loading') {
      voiceService.stop();
    } else if (voiceState === 'failed') {
      voiceService.retry();
    } else if (insight?.response_text) {
      voiceService.speak(insight.response_text, {
        lang: context?.language || 'en',
        // English voice_script authored by the backend. Used automatically when
        // the host has no hi-IN/mr-IN TTS voice and the Devanagari text would
        // otherwise be garbled or silent through an English voice.
        fallbackText: insight?.context_summary?.voice_script || undefined,
      });
    }
  };

  // Helper for provenance badge styling
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

  // Localized text helpers for voice controls
  const getVoiceButtonContent = () => {
    const lang = context?.language || 'en';

    if (voiceState === 'loading') {
      return {
        icon: '⏳',
        label: lang === 'hi' ? 'लोड हो रहा है...' : lang === 'mr' ? 'लोड होत आहे...' : 'Loading...',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
      };
    }

    if (voiceState === 'playing') {
      return {
        icon: '⏹',
        label: lang === 'hi' ? 'रोकें' : lang === 'mr' ? 'थांबवा' : 'Stop',
        color: '#f87171',
        bg: 'rgba(239, 68, 68, 0.18)',
        border: 'rgba(239, 68, 68, 0.4)',
      };
    }

    if (voiceState === 'failed') {
      return {
        icon: '🔄',
        label: lang === 'hi' ? 'पुनः प्रयास' : lang === 'mr' ? 'पुन्हा प्रयत्न' : 'Retry',
        color: '#fb923c',
        bg: 'rgba(251, 146, 60, 0.15)',
        border: 'rgba(251, 146, 60, 0.35)',
      };
    }

    // Default 'idle' / 'stopped'
    return {
      icon: '🔊',
      label: lang === 'hi' ? 'सुनें' : lang === 'mr' ? 'ऐका' : 'Listen',
      color: '#cbd5e1',
      bg: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.12)',
    };
  };

  const badge = getProvenanceBadge();
  const voiceBtn = getVoiceButtonContent();

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

        {/* Voice Trigger / State Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {voiceState === 'failed' && (
            <span
              style={{
                fontSize: '10px',
                color: '#f87171',
                fontFamily: 'monospace',
              }}
              title={voiceError || 'Voice synthesis error'}
            >
              ⚠️ Voice unavailable
            </span>
          )}

          <button
            onClick={handleToggleVoice}
            disabled={loading || !insight?.response_text}
            style={{
              background: voiceBtn.bg,
              border: `1px solid ${voiceBtn.border}`,
              borderRadius: '8px',
              color: voiceBtn.color,
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              outline: 'none',
              boxShadow: voiceState === 'playing' ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none',
            }}
            title={voiceState === 'failed' ? (voiceError || 'Click to retry audio') : undefined}
          >
            <span>{voiceBtn.icon}</span>
            <span>{voiceBtn.label}</span>
          </button>
        </div>
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
