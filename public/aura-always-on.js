/* AURA Always-On Voice Controller
 * Browser-safe wake-word layer. Browsers may suspend microphone capture in
 * background tabs; this controller automatically recovers when the page resumes.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'aura.always-on-voice.v1';
  const WAKE_WORDS = [
    'hey aura assistant',
    'aura assistant',
    'hey aura',
    'okay aura',
    'ok aura',
    'aura'
  ];

  let recognition = null;
  let enabled = localStorage.getItem(STORAGE_KEY) === 'true';
  let explicitlyStopped = false;
  let retryTimer = null;
  let unlocked = false;

  function Recognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripWakeWord(text) {
    let value = normalize(text);
    for (const wake of WAKE_WORDS) {
      if (value === wake) return '';
      if (value.startsWith(wake + ' ')) return value.slice(wake.length).trim();
    }
    return value;
  }

  function hasWakeWord(text) {
    const value = normalize(text);
    return WAKE_WORDS.some(w => value === w || value.startsWith(w + ' '));
  }

  function language() {
    return window.AURA_VOICE_LANGUAGE || document.documentElement.lang || navigator.language || 'en-IN';
  }

  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent('aura:always-on:' + type, { detail }));
  }

  function scheduleRestart(delay = 700) {
    clearTimeout(retryTimer);
    if (!enabled || explicitlyStopped || document.hidden) return;
    retryTimer = setTimeout(start, delay);
  }

  function buildRecognition() {
    const Ctor = Recognition();
    if (!Ctor) return null;

    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.lang = language();

    r.onstart = () => emit('state', { listening: true, enabled });
    r.onend = () => {
      emit('state', { listening: false, enabled });
      scheduleRestart();
    };
    r.onerror = event => {
      emit('error', { error: event.error || 'unknown' });
      if (event.error !== 'not-allowed' && event.error !== 'service-not-allowed') {
        scheduleRestart(1200);
      }
    };
    r.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (!result.isFinal && !hasWakeWord(transcript)) continue;
        if (!hasWakeWord(transcript)) continue;

        const command = stripWakeWord(transcript);
        emit('wake', { transcript, command, final: result.isFinal });

        if (command) {
          emit('command', { command, transcript });
          const input = document.querySelector('#userInput, textarea[name="message"], input[name="message"]');
          if (input) {
            input.value = command;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
    };

    return r;
  }

  function start() {
    if (!enabled || explicitlyStopped || document.hidden || !Recognition()) return false;
    if (recognition) {
      try { recognition.abort(); } catch (_) {}
    }
    recognition = buildRecognition();
    if (!recognition) return false;
    try {
      recognition.start();
      return true;
    } catch (_) {
      scheduleRestart(1000);
      return false;
    }
  }

  function stop() {
    explicitlyStopped = true;
    clearTimeout(retryTimer);
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    emit('state', { listening: false, enabled });
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    localStorage.setItem(STORAGE_KEY, String(enabled));
    explicitlyStopped = !enabled;
    if (enabled) start();
    else stop();
    emit('state', { listening: Boolean(recognition), enabled });
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (enabled) start();
  }

  window.AuraAlwaysOnVoice = {
    start,
    stop,
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    isEnabled: () => enabled,
    getWakeWords: () => [...WAKE_WORDS],
    normalize,
    stripWakeWord
  };

  ['pointerdown', 'touchstart', 'keydown'].forEach(type => {
    window.addEventListener(type, unlock, { once: true, passive: true });
  });

  window.addEventListener('online', () => scheduleRestart(300));
  window.addEventListener('pageshow', () => scheduleRestart(300));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRestart(300);
  });

  if (enabled) {
    explicitlyStopped = false;
    scheduleRestart(1200);
  }
})();
