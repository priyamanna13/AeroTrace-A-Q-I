/**
 * test_voice_service.mjs — Test suite for AeroTrace Contextual Voice & Read-Aloud Subsystem
 * (Anish — Intelligence Subsystem | AeroTrace NGEC 2026)
 * 
 * Tests:
 * 1. Locale resolution (en, hi, mr)
 * 2. PCM 16-bit Base64 to Float32 decoding fidelity (MYRAA extraction)
 * 3. Provider capability detection & safety in non-browser environments
 * 4. State machine transitions: idle -> loading -> playing -> stopped -> failed
 * 5. Failure resilience: degraded state without throwing unhandled exceptions
 * 6. Retry behavior
 * 7. Backward compatibility of VoiceController bridge
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getVoiceLocale,
  findBestVoice,
  pcm16Base64ToFloat32,
  WebSpeechVoiceProvider,
  WebAudioPCMVoiceProvider,
  VoiceService,
} from '../frontend/src/services/voiceService.js';

import { VoiceController, globalVoice } from '../frontend/src/utils/voice.js';

test('1. Locale resolution maps correctly for Indic languages', () => {
  assert.equal(getVoiceLocale('hi'), 'hi-IN');
  assert.equal(getVoiceLocale('mr'), 'mr-IN');
  assert.equal(getVoiceLocale('en'), 'en-IN');
  assert.equal(getVoiceLocale('unknown'), 'en-IN');
});

test('2. findBestVoice gracefully returns null when window is undefined', () => {
  assert.equal(findBestVoice('hi'), null);
  assert.equal(findBestVoice('mr'), null);
  assert.equal(findBestVoice('en'), null);
});

test('3. PCM 16-bit to Float32 decoding conversion fidelity', () => {
  // Test in non-browser environment
  const empty = pcm16Base64ToFloat32('');
  assert.equal(empty.length, 0);

  // Mock window.atob for testing decoding algorithm
  global.window = {
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
  };

  try {
    // Generate 2 PCM 16 samples: 0, and 32767 (max int16 ~ +1.0)
    const buf = Buffer.alloc(4);
    buf.writeInt16LE(0, 0);
    buf.writeInt16LE(32767, 2);
    const b64 = buf.toString('base64');

    const float32 = pcm16Base64ToFloat32(b64);
    assert.equal(float32.length, 2);
    assert.equal(float32[0], 0.0);
    assert.ok(Math.abs(float32[1] - (32767 / 32768.0)) < 0.0001);
  } finally {
    delete global.window;
  }
});

test('4. WebSpeechVoiceProvider isSupported and safe without window', () => {
  const provider = new WebSpeechVoiceProvider();
  assert.equal(provider.isSupported(), false);
  assert.equal(provider.name, 'web_speech');
  // stop() should not throw
  assert.doesNotThrow(() => provider.stop());
});

test('5. WebAudioPCMVoiceProvider isSupported and safe without window', () => {
  const provider = new WebAudioPCMVoiceProvider();
  assert.equal(provider.isSupported(), false);
  assert.equal(provider.name, 'pcm_stream');
  // stop() should not throw
  assert.doesNotThrow(() => provider.stop());
});

test('6. VoiceService initial state and subscription pattern', () => {
  const service = new VoiceService();
  assert.equal(service.getState(), 'idle');
  assert.equal(service.getError(), null);

  const states = [];
  const unsubscribe = service.subscribe((state) => {
    states.push(state);
  });

  assert.deepEqual(states, ['idle']);
  unsubscribe();
});

test('7. VoiceService speak fails gracefully when speech API is unsupported', async () => {
  const service = new VoiceService();
  const states = [];
  service.subscribe((state) => states.push(state));

  await service.speak('High AQI in Pune', { lang: 'en' });

  // Should transition to loading then failed gracefully, never throwing unhandled exception
  assert.ok(states.includes('loading'));
  assert.equal(service.getState(), 'failed');
  assert.ok(service.getError() !== null);
  assert.ok(service.getError().message.includes('not supported'));
});

test('8. VoiceService retry remembers last spoken text and options', async () => {
  const service = new VoiceService();
  await service.speak('AQI Alert Level Red', { lang: 'hi' });
  assert.equal(service.lastSpokenText, 'AQI Alert Level Red');
  assert.equal(service.lastOptions.lang, 'hi');

  // Calling retry should re-attempt with identical parameters
  let retried = false;
  service.speak = (text, opts) => {
    assert.equal(text, 'AQI Alert Level Red');
    assert.equal(opts.lang, 'hi');
    retried = true;
  };

  service.retry();
  assert.equal(retried, true);
});

test('9. VoiceService with mocked Web Speech API executes full lifecycle', async () => {
  // Mock browser window and SpeechSynthesis
  let spokeUtterance = null;
  global.window = {
    speechSynthesis: {
      getVoices: () => [{ lang: 'hi-IN', name: 'Hindi' }],
      speak: (utterance) => {
        spokeUtterance = utterance;
        setTimeout(() => {
          if (utterance.onstart) utterance.onstart();
          setTimeout(() => {
            if (utterance.onend) utterance.onend();
          }, 10);
        }, 5);
      },
      cancel: () => {},
    },
  };
  global.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.lang = 'en';
      this.rate = 1;
      this.pitch = 1;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  };

  try {
    const service = new VoiceService();
    const states = [];
    service.subscribe((state) => states.push(state));

    await service.speak('पुण्यात हवेची गुणवत्ता मध्यम आहे. खबरदारी घ्या.', { lang: 'mr' });

    // Wait for async playback
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(states.includes('loading'));
    assert.ok(states.includes('playing'));
    assert.equal(service.getState(), 'idle');
    assert.equal(service.getError(), null);
  } finally {
    delete global.window;
    delete global.SpeechSynthesisUtterance;
  }
});

test('10. Backward-compatible VoiceController and globalVoice integration', () => {
  assert.ok(globalVoice instanceof VoiceController);
  assert.equal(globalVoice.isSpeaking, false);
  assert.doesNotThrow(() => globalVoice.stop());
});
