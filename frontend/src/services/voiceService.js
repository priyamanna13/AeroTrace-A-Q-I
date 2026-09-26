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

/**
 * Devanagari-script languages. Hindi and Marathi both use the Devanagari
 * abugida, so a hi-IN voice can phonetically pronounce Marathi text —
 * but an English voice reading Devanagari codepoints produces silence or
 * letter-by-letter garble on most OS/browser TTS stacks.
 */
const DEVANAGARI_LANGS = new Set(['hi', 'mr']);

/**
 * Detects whether text contains Devanagari codepoints (U+0900–U+097F).
 * Used to auto-downgrade to the English voice_script when no Indic voice
 * exists on the host OS/browser.
 */
export function isDevanagariText(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0900-\u097F]/.test(text);
}

export function getVoiceLocale(lang) {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'mr') return 'mr-IN';
  return 'en-IN';
}

/**
 * Resolves the best available SpeechSynthesis voice for a requested language.
 *
 * Fallback chain (CRITICAL for Indic UX):
 *   mr → mr-IN exact → any mr-* → hi-IN/hi-* (Hindi voices pronounce
 *        Devanagari phonetically) → en-IN/en-GB → any en-*
 *   hi → hi-IN exact → any hi-* → mr-IN/mr-* → en-IN/en-GB → any en-*
 *   en → en-IN exact → any en-* → null
 *
 * Returns the resolved voice AND its language tag so callers can detect
 * when an Indic request was downgraded to an English voice.
 */
export function findBestVoice(lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const targetCode = getVoiceLocale(lang);
  const prefix = targetCode.split('-')[0];

  // 1. Exact locale match (e.g. "mr-IN", "hi-IN", "en-IN")
  let voice = voices.find(v => v.lang === targetCode);
  if (voice) return voice;

  // 2. Same primary-language prefix (e.g. "mr-*" or "hi-*")
  voice = voices.find(v => v.lang && v.lang.startsWith(prefix + '-'));
  if (voice) return voice;

  // 3. Cross-Indic fallback within Devanagari languages (mr↔hi).
  //    Hindi TTS engines pronounce Marathi Devanagari acceptably; the reverse
  //    also works. A base prefix match ('hi' === 'hi' with no region) is
  //    included here for OSes reporting bare language tags.
  if (DEVANAGARI_LANGS.has(lang)) {
    const crossPrefix = lang === 'mr' ? 'hi' : 'mr';
    voice = voices.find(v => v.lang === crossPrefix)
      || voices.find(v => v.lang && v.lang.startsWith(crossPrefix + '-'));
    if (voice) return voice;
  }

  // 4. Indian/Indian-English voice for Indic requests (neutral accent for names)
  if (DEVANAGARI_LANGS.has(lang)) {
    voice = voices.find(v => v.lang && (v.lang.startsWith('en-IN') || v.lang.startsWith('en-GB')));
    if (voice) return voice;
  }

  // 5. Any English voice (last resort)
  return voices.find(v => v.lang && v.lang.startsWith('en')) || null;
}

/**
 * Decides the effective spoken text + voice language for a request.
 *
 * THE CRITICAL FIX: when the UI language is Hindi/Marathi but the host has NO
 * hi-IN/mr-IN voice, speaking Devanagari text through an English voice yields
 * silence or garbled phonemes. In that case we downgrade to the pre-authored
 * English `context_summary.voice_script` (backend always provides one) and
 * speak it with an English voice so the user hears clean audio instead of a
 * broken rendition.
 *
 * Returns { text, lang, voice } — text/lang adjusted when downgraded.
 */
export function resolveSpeakableText(text, lang = 'en') {
  const requestedLang = lang || 'en';
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return { text, lang: requestedLang, voice: null };
  }

  const voice = findBestVoice(requestedLang);
  const voiceLang = voice?.lang || '';
  const voiceIsIndic = voiceLang.startsWith('hi') || voiceLang.startsWith('mr');

  // Indic requested + no Indic voice available + text is Devanagari → downgrade
  if (
    DEVANAGARI_LANGS.has(requestedLang) &&
    !voiceIsIndic &&
    isDevanagariText(text)
  ) {
    return { text, lang: requestedLang, voice, devanagariUnsupported: true };
  }

  return { text, lang: requestedLang, voice, devanagariUnsupported: false };
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

  speak(text, { lang = 'en', fallbackText = null, onStart, onEnd, onError } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        const err = new Error('SpeechSynthesis API is not supported in this browser environment.');
        if (onError) onError(err);
        return reject(err);
      }

      this.stop();
      this.isCanceled = false;

      // Resolve voice + detect the Devanagari-downgrade case ONCE up front.
      // If hi/mr was requested but only an English voice exists, speaking
      // Devanagari text would produce silence/garble — swap in the English
      // voice_script supplied by the caller (context_summary.voice_script).
      const resolution = resolveSpeakableText(text, lang);
      const effectiveText = resolution.devanagariUnsupported
        ? (fallbackText || '')
        : text;
      const effectiveLang = resolution.devanagariUnsupported
        ? getVoiceLocale('en')
        : getVoiceLocale(lang);
      const voice = resolution.devanagariUnsupported
        ? findBestVoice('en')
        : resolution.voice;

      if (resolution.devanagariUnsupported && !effectiveText) {
        // No English script fallback was provided — refuse to emit garble.
        console.warn(
          '[WebSpeechVoiceProvider] No Indic TTS voice available and no English fallback script supplied; skipping speech.'
        );
        const err = new Error('No Indic TTS voice installed and no English fallback text available.');
        if (onError) onError(err);
        return resolve();
      }

      // Sentence chunking for natural pauses (supporting Indic punctuation '।' as well as '.!?')
      const sentences = effectiveText
        .split(/(?<=[.!?।\n])/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (sentences.length === 0) {
        if (onEnd) onEnd();
        return resolve();
      }

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
        utterance.lang = effectiveLang;
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

    // Pre-flight: detect the Devanagari-downgrade case before touching the
    // state machine, so the caller can supply a fallback script cleanly.
    let spokenText = text;
    let spokenLang = lang;
    if (provider !== 'pcm') {
      const resolution = resolveSpeakableText(text, lang);
      if (resolution.devanagariUnsupported) {
        if (options.fallbackText && typeof options.fallbackText === 'string' && options.fallbackText.trim()) {
          console.info('[VoiceService] No hi/mr TTS voice on host — using English voice_script fallback.');
          spokenText = options.fallbackText;
          spokenLang = 'en';
          this.lastSpokenText = spokenText;
        } else {
          // Without a fallback script an English voice would garble Devanagari.
          this._setState(
            'failed',
            new Error('No Hindi/Marathi TTS voice is installed on this device, and no English fallback script was provided.')
          );
          return;
        }
      }
    }

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
      await selected.speak(spokenText, {
        lang: spokenLang,
        fallbackText: options.fallbackText,
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
/**
 * Global Singleton Instance
 *
 * Language-switch hygiene: any UI that changes the active language should call
 * `voiceService.stop()` (or simply trigger `speak()` again with the new
 * language) so stale audio in the previous language never keeps playing.
 */
export const voiceService = new VoiceService();
