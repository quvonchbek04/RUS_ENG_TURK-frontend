// Web Speech API ustidan qurilgan yordamchi funksiyalar — brauzer ichida ishlaydi.

export function langToBCP47(lang) {
  return lang === 'ru' ? 'ru-RU' : lang === 'tr' ? 'tr-TR' : lang === 'uz' ? 'uz-UZ' : 'en-US';
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

function makeUtterance(text, lang, { rate = 0.9, voiceURI } = {}) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langToBCP47(lang);
  u.rate = rate;
  const voices = window.speechSynthesis.getVoices() || [];
  const v = voiceURI ? voices.find((x) => x.voiceURI === voiceURI) : null;
  if (v) u.voice = v;
  else {
    const prefix = u.lang.slice(0, 2).toLowerCase();
    const auto = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(prefix));
    if (auto) u.voice = auto;
  }
  return u;
}

/** Bitta so'z/gapni o'qiydi (talaffuz tugmalari uchun). */
export function speakSimple(text, lang, opts = {}) {
  if (!isSpeechSupported() || !text) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(makeUtterance(text, lang, opts));
}

/** Bitta gapni o'qiydi va tugaganda onEnd chaqiradi (rolli o'qish uchun). */
export function speakWithEnd(text, lang, { rate = 0.9, voiceURI } = {}, onEnd) {
  if (!isSpeechSupported() || !text) {
    onEnd?.();
    return () => {};
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onEnd?.();
  };
  window.speechSynthesis.cancel();
  const u = makeUtterance(text, lang, { rate, voiceURI });
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.speak(u);
  return () => {
    done = true;
    window.speechSynthesis.cancel();
  };
}

/** Mikrofon orqali gapni taniydi (brauzer qo'llab-quvvatlasa). */
export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Bir nechta gapni ketma-ket o'qiydi (masalan butun dialog). onLine(i) — hozir o'qilayotgan qator.
 *  Qaytaradi: to'xtatish funksiyasi. */
export function speakSequence(lines, lang, { rate = 0.9, voiceURI, onLine, onEnd } = {}) {
  if (!isSpeechSupported() || !lines.length) {
    onEnd?.();
    return () => {};
  }
  let stopped = false;
  window.speechSynthesis.cancel();
  const next = (i) => {
    if (stopped) return;
    if (i >= lines.length) {
      onLine?.(-1);
      onEnd?.();
      return;
    }
    onLine?.(i);
    const u = makeUtterance(lines[i], lang, { rate, voiceURI });
    u.onend = () => setTimeout(() => next(i + 1), 350);
    u.onerror = () => next(i + 1);
    window.speechSynthesis.speak(u);
  };
  next(0);
  return () => {
    stopped = true;
    window.speechSynthesis.cancel();
    onLine?.(-1);
  };
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

/** So'zlarning taxminiy vaqt jadvali — matn uzunligiga proporsional (boundary hodisasi ishonchsiz). */
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
