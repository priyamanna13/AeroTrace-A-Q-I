/**
 * voice.js — Contextual Speech Synthesis Engine (Anish — Intelligence Subsystem)
 * 
 * Provides robust Web Speech API playback with sentence-chunking, locale resolution,
 * and lifecycle tracking for en-IN, hi-IN, and mr-IN.
 */

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

export class VoiceController {
  constructor() {
    this.isSpeaking = false;
    this.currentText = '';
    this.onStateChange = null;
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

  stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    if (this.onStateChange) this.onStateChange(false);
  }

  speak(text, lang = 'en', onComplete = null) {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;

    this.stop();
    this.currentText = text;
    this.isSpeaking = true;
    if (this.onStateChange) this.onStateChange(true);

    // Sentence chunking on punctuation for natural pauses
    const sentences = text
      .split(/(?<=[.!?।])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) {
      this.isSpeaking = false;
      if (this.onStateChange) this.onStateChange(false);
      return;
    }

    const langCode = getVoiceLocale(lang);
    const voice = findBestVoice(lang);

    const speakChain = (index) => {
      if (index >= sentences.length || !this.isSpeaking) {
        this.isSpeaking = false;
        if (this.onStateChange) this.onStateChange(false);
        if (onComplete) onComplete();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      utterance.lang = langCode;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      if (voice) utterance.voice = voice;

      utterance.onend = () => speakChain(index + 1);
      utterance.onerror = () => speakChain(index + 1);

      window.speechSynthesis.speak(utterance);
    };

    speakChain(0);
  }
}

export const globalVoice = new VoiceController();
