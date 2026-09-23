/**
 * voiceService.js — AeroTrace Contextual Voice & Read-Aloud Subsystem
 * (Anish — Intelligence Subsystem | AeroTrace NGEC 2026)
 * 
 * Architecture:
 * - Provider Abstraction:
 *     1. WebSpeechVoiceProvider: Zero-dependency browser SpeechSynthesis with Indic support (en-IN, hi-IN, mr-IN)
 *        and punctuation sentence-chunking for natural pauses.
 *     2. WebAudioPCMVoiceProvider: Low-latency Web Audio API chunk queuing with jitter buffer & Int16->Float32
 *        conversion (adapted from MYRAA streaming audio reference, without heavy desktop/mic dependencies).
 * - State Machine: 'idle' | 'loading' | 'playing' | 'stopped' | 'failed'
 * - Resilience: Failures degrade gracefully to text. Never throws or crashes the UI. Allows instant retry.
 */

// ─── HELPER UTILITIES ─────────────────────────────────────────────────────────

export function getVoiceLocale(lang) {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'mr') return 'mr-IN';
  return 'en-IN';
}

export function findBestVoice(lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const targetCode = getVoiceLocale(lang);

  // 1. Exact match (e.g. "hi-IN", "en-IN")
  let voice = voices.find(v => v.lang === targetCode);
  if (voice) return voice;

  // 2. Prefix match
  const prefix = targetCode.split('-')[0];
  voice = voices.find(v => v.lang.startsWith(prefix));
  if (voice) return voice;

  // 3. Indian English fallback for Indic languages
  if (lang === 'hi' || lang === 'mr') {
    voice = voices.find(v => v.lang.startsWith('en-IN') || v.lang.startsWith('en-GB'));
    if (voice) return voice;
  }

  // 4. Any English voice
  return voices.find(v => v.lang.startsWith('en')) || null;
}

/**
 * Converts Base64 encoded PCM 16-bit to Float32Array normalized between -1.0 and 1.0.
 * Directly extracted from MYRAA audio engine.
 */
export function pcm16Base64ToFloat32(base64Str) {
  if (typeof window === 'undefined') return new Float32Array(0);
  const binary = window.atob(base64Str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

// ─── PROVIDER 1: WEB SPEECH API (ZERO DEPENDENCY / OFFLINE FALLBACK) ──────────

export class WebSpeechVoiceProvider {
  constructor() {
    this.name = 'web_speech';
    this.currentUtterances = [];
    this.activeUtteranceIndex = 0;
    this.isCanceled = false;
    this._initVoices();
  }

  _initVoices() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        if (window.speechSynthesis) window.speechSynthesis.getVoices();
      };
    }
  }

  isSupported() {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
  }

  stop() {
    this.isCanceled = true;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('[WebSpeechVoiceProvider] cancel error:', e);
      }
    }
    this.currentUtterances = [];
    this.activeUtteranceIndex = 0;
  }

  speak(text, { lang = 'en', onStart, onEnd, onError } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        const err = new Error('SpeechSynthesis API is not supported in this browser environment.');
        if (onError) onError(err);
        return reject(err);
      }

      this.stop();
      this.isCanceled = false;

      // Sentence chunking for natural pauses (supporting Indic punctuation '।' as well as '.!?')
      const sentences = text
        .split(/(?<=[.!?।\n])/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (sentences.length === 0) {
        if (onEnd) onEnd();
        return resolve();
      }

      const langCode = getVoiceLocale(lang);
      const voice = findBestVoice(lang);
      let started = false;

      const speakSentence = (index) => {
        if (this.isCanceled) {
          return resolve();
        }

        if (index >= sentences.length) {
          if (onEnd) onEnd();
          return resolve();
        }

        this.activeUtteranceIndex = index;
        const utterance = new SpeechSynthesisUtterance(sentences[index]);
        utterance.lang = langCode;
        utterance.rate = 0.92;
        utterance.pitch = 1.0;
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
          if (!started) {
            started = true;
            if (onStart) onStart();
          }
        };

        utterance.onend = () => {
          if (!this.isCanceled) {
            speakSentence(index + 1);
          }
        };

        utterance.onerror = (e) => {
          // If canceled by user, don't treat as fatal failure
          if (this.isCanceled || e.error === 'canceled' || e.error === 'interrupted') {
            return resolve();
          }
          console.warn('[WebSpeechVoiceProvider] utterance error:', e);
          const err = new Error(e.error || 'Speech synthesis error');
          if (onError) onError(err);
          // Attempt graceful fallback to next sentence rather than crashing
          speakSentence(index + 1);
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          if (onError) onError(err);
          reject(err);
        }
      };

      speakSentence(0);
    });
  }
}

// ─── PROVIDER 2: WEB AUDIO PCM STREAMING (MYRAA QUEUE PATTERN) ────────────────

export class WebAudioPCMVoiceProvider {
  constructor() {
    this.name = 'pcm_stream';
    this.audioCtx = null;
    this.gainNode = null;
    this.nextStartTime = 0;
    this.activeSources = [];
    this.isPlaying = false;
  }

  isSupported() {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
  }

  async _ensureAudioContext(sampleRate = 24000) {
    if (!this.isSupported()) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate });
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  stop() {
    this.isPlaying = false;
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already have ended
      }
    });
    this.activeSources = [];
    this.nextStartTime = 0;
  }

  /**
   * Enqueues and plays a single PCM 16-bit chunk (base64 encoded).
   * Implements the MYRAA jitter-buffer sequential scheduling pattern.
   */
  async playChunk(base64Chunk, sampleRate = 24000, { onStart, onEnd, onError } = {}) {
    try {
      await this._ensureAudioContext(sampleRate);
      const float32Data = pcm16Base64ToFloat32(base64Chunk);
      if (float32Data.length === 0) return;

      const buffer = this.audioCtx.createBuffer(1, float32Data.length, sampleRate);
      buffer.getChannelData(0).set(float32Data);

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);

      const now = this.audioCtx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.03; // 30ms jitter buffer
      }

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.activeSources.push(source);

      if (!this.isPlaying) {
        this.isPlaying = true;
        if (onStart) onStart();
      }

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) this.activeSources.splice(idx, 1);
        if (this.activeSources.length === 0) {
          this.isPlaying = false;
          if (onEnd) onEnd();
        }
      };
    } catch (err) {
      console.warn('[WebAudioPCMVoiceProvider] Play chunk error:', err);
      if (onError) onError(err);
    }
  }
}

// ─── UNIFIED VOICE SERVICE MANAGER (ANISH INTELLIGENCE LAYER) ──────────────────

export class VoiceService {
  constructor() {
    this.state = 'idle'; // 'idle' | 'loading' | 'playing' | 'stopped' | 'failed'
    this.lastError = null;
    this.lastSpokenText = '';
    this.lastOptions = {};
    this.subscribers = new Set();

    this.webSpeechProvider = new WebSpeechVoiceProvider();
    this.pcmProvider = new WebAudioPCMVoiceProvider();
    this.activeProvider = this.webSpeechProvider;
  }

  getState() {
    return this.state;
  }

  getError() {
    return this.lastError;
  }

  _setState(newState, error = null) {
    this.state = newState;
    this.lastError = error;
    this.subscribers.forEach((callback) => {
      try {
        callback(this.state, this.lastError);
      } catch (err) {
        console.error('[VoiceService] Subscriber error:', err);
      }
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    // Send immediate initial state
    callback(this.state, this.lastError);
    return () => this.subscribers.delete(callback);
  }

  stop() {
    this.webSpeechProvider.stop();
    this.pcmProvider.stop();
    this._setState('idle');
  }

  async speak(text, options = {}) {
    if (!text || typeof text !== 'string') {
      this._setState('idle');
      return;
    }

    this.lastSpokenText = text;
    this.lastOptions = options;
    const { lang = 'en', provider = 'auto' } = options;

    this.stop();
    this._setState('loading');

    // Select provider
    let selected = this.webSpeechProvider;
    if (provider === 'pcm' && this.pcmProvider.isSupported()) {
      selected = this.pcmProvider;
    } else if (!this.webSpeechProvider.isSupported()) {
      this._setState('failed', new Error('Web Speech API is not supported in your browser.'));
      return;
    }
    this.activeProvider = selected;

    try {
      await selected.speak(text, {
        lang,
        onStart: () => {
          this._setState('playing');
        },
        onEnd: () => {
          this._setState('idle');
        },
        onError: (err) => {
          console.warn('[VoiceService] Provider error:', err);
          this._setState('failed', err);
        },
      });
    } catch (err) {
      console.warn('[VoiceService] speak failed:', err);
      this._setState('failed', err);
    }
  }

  /**
   * Re-triggers the previous speech request.
   * Useful when speech encountered a network glitch or user toggles retry.
   */
  retry() {
    if (this.lastSpokenText) {
      return this.speak(this.lastSpokenText, this.lastOptions);
    }
  }

  /**
   * Receives streaming PCM audio chunk (e.g. from future Gemini Live or server TTS).
   */
  async playPCMStreamChunk(base64Chunk, sampleRate = 24000) {
    this.activeProvider = this.pcmProvider;
    return this.pcmProvider.playChunk(base64Chunk, sampleRate, {
      onStart: () => this._setState('playing'),
      onEnd: () => this._setState('idle'),
      onError: (err) => this._setState('failed', err),
    });
  }
}

// Global Singleton Instance
export const voiceService = new VoiceService();
