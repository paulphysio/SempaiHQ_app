// Web: read-aloud with the browser's built-in speech (Web Speech API).
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const listeners = {};
const emit = (event, payload) => (listeners[event] || []).forEach((fn) => { try { fn(payload); } catch {} });
let rate = 1, pitch = 1, lang;
const Tts = {
  getInitStatus: async () => (synth ? 'success' : Promise.reject(new Error('Speech not supported'))),
  setDefaultRate: async (r) => { rate = Math.max(0.1, Math.min(2, (r || 0.5) * 2)); },
  setDefaultPitch: async (p) => { pitch = p || 1; },
  setDefaultLanguage: async (l) => { lang = l; },
  setDucking: async () => {},
  voices: async () => (synth ? synth.getVoices().map((v) => ({ id: v.voiceURI, name: v.name, language: v.lang })) : []),
  speak: (text) => {
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(String(text || ''));
    u.rate = rate; u.pitch = pitch; if (lang) u.lang = lang;
    u.onstart = () => emit('tts-start', {});
    u.onend = () => emit('tts-finish', {});
    u.onerror = () => emit('tts-error', {});
    synth.speak(u);
  },
  stop: () => { if (synth) { synth.cancel(); emit('tts-cancel', {}); } },
  pause: () => synth && synth.pause(),
  resume: () => synth && synth.resume(),
  addEventListener: (event, fn) => { (listeners[event] = listeners[event] || []).push(fn); return { remove: () => Tts.removeEventListener(event, fn) }; },
  removeEventListener: (event, fn) => { listeners[event] = (listeners[event] || []).filter((f) => f !== fn); },
  removeAllListeners: (event) => { if (event) delete listeners[event]; },
};
export default Tts;
