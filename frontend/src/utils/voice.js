/**
 * voice.js — Backward-Compatible Voice Controller & Re-exports
 * (Anish — Intelligence Subsystem | AeroTrace NGEC 2026)
 * 
 * Re-exports the unified voiceService and provides the legacy VoiceController
 * and globalVoice for seamless backward compatibility across the application.
 */

import { voiceService, getVoiceLocale, findBestVoice, pcm16Base64ToFloat32, resolveSpeakableText, isDevanagariText } from '../services/voiceService.js';

export { voiceService, getVoiceLocale, findBestVoice, pcm16Base64ToFloat32, resolveSpeakableText, isDevanagariText };

export class VoiceController {
  constructor() {
    this.voiceService = voiceService;
    this.onStateChange = null;

    // Bridge voiceService state to legacy onStateChange(boolean)
    this.voiceService.subscribe((state) => {
      if (this.onStateChange) {
        this.onStateChange(state === 'playing');
      }
    });
  }

  get isSpeaking() {
    return this.voiceService.getState() === 'playing';
  }

  stop() {
    this.voiceService.stop();
  }

  speak(text, lang = 'en', onComplete = null, fallbackText = null) {
    this.voiceService.speak(text, {
      lang,
      fallbackText: fallbackText || undefined,
      onEnd: onComplete,
    });
  }
}

export const globalVoice = new VoiceController();
