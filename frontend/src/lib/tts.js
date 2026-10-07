// Web Speech API ustidan qurilgan yordamchi funksiyalar — offline, brauzer ichida ishlaydi.

export function langToBCP47(lang) {
  return lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : 'en-US';
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getVoicesFor(lang) {
  if (!isSpeechSupported()) return [];
  const prefix = lang === 'ru' ? 'ru' : lang === 'tr' ? 'tr' : 'en';
  const all = window.speechSynthesis.getVoices() || [];
  return all.filter((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
}

/** Bitta so'z/gapni oddiy tarzda o'qiydi (talaffuz tugmalari uchun). */
export function speakSimple(text, lang, { rate = 0.9, voiceURI } = {}) {
  if (!isSpeechSupported() || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langToBCP47(lang);
  u.rate = rate;
  if (voiceURI) {
    const v = (window.speechSynthesis.getVoices() || []).find((x) => x.voiceURI === voiceURI);
    if (v) u.voice = v;
  }
  window.speechSynthesis.speak(u);
}

/** Matnni so'zlarga (span) ajratadi — har biri {start, end, word} belgi indeksi bilan. */
export function buildWordSpans(text) {
  const regex = /\S+/g;
  const spans = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    spans.push({ start: match.index, end: match.index + match[0].length, word: match[0] });
  }
  return spans;
}

/**
 * So'zlarning taxminiy vaqt jadvalini tuzadi — matn uzunligiga proporsional.
 * Brauzerning "boundary" hodisasi ishonchsiz ishlagani uchun shu usul qo'llanadi
 * (asl HTML ilovadagi yechim bilan bir xil).
 */
export function buildWordTimings(text, spans, rate = 0.9) {
  const totalLen = Math.max(text.length, 1);
  const CHARS_PER_SEC_AT_RATE_1 = 15;
  const msPerChar = 1000 / (CHARS_PER_SEC_AT_RATE_1 * (rate || 0.9));
  const totalMs = Math.max(600, totalLen * msPerChar);
  const timings = spans.map((s) => ({
    start: (s.start / totalLen) * totalMs,
    end: (s.end / totalLen) * totalMs,
  }));
  return { timings, totalMs };
}
