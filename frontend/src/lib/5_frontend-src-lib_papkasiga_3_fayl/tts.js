// Web Speech API ustidan qurilgan yordamchi funksiyalar — brauzer ichida ishlaydi.
//
// Telefonlarda (Android Chrome, iOS Safari) ishonchli ishlashi uchun:
//  • matn gaplarga bo'linib ketma-ket o'qiladi (uzun matn bitta bo'lak bo'lsa, Android 15–30 soniyadan keyin to'xtab qoladi);
//  • o'qilayotgan obyektlar xotirada ushlab turiladi (Chrome ularni o'chirib yuborsa, `onend` kelmaydi va ovoz o'rtada uziladi);
//  • "qotib qolgan" bo'lakni kuzatuvchi taymer (watchdog) keyingisiga o'tkazadi;
//  • ovozlar ro'yxati kech yuklanishi hisobga olingan (`voiceschanged`), mahalliy (oflayn) ovozlar afzal;
//  • iPhone'da birinchi bosishda ovoz "ochiladi" (unlockSpeech), keyin avtomatik o'qishlar ham ishlaydi;
//  • telefonda kerakli til ovozi o'rnatilmagan bo'lsa, foydalanuvchiga bildiriladi.
import { t } from '../i18n/index.js';

const BCP47 = { ru: 'ru-RU', tr: 'tr-TR', uz: 'uz-UZ', en: 'en-US' };

export function langToBCP47(lang) {
  return BCP47[lang] || 'en-US';
}

const prefixOf = (lang) => (lang === 'ru' ? 'ru' : lang === 'tr' ? 'tr' : lang === 'uz' ? 'uz' : 'en');

function synth() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function isSpeechSupported() {
  return !!synth();
}

// ---------------------------------------------------------------------------
// Ovozlar ro'yxati
// ---------------------------------------------------------------------------
let voiceCache = [];
let primed = false;
const voiceListeners = new Set();

function refreshVoices() {
  const s = synth();
  const list = (s && s.getVoices && s.getVoices()) || [];
  if (list.length) voiceCache = list;
  voiceListeners.forEach((fn) => fn());
}

/** Ovozlar ro'yxatini oldindan yuklashni boshlaydi (Android/Chrome'da u dastlab bo'sh bo'ladi). Ilova ochilganda bir marta chaqiriladi. */
export function primeVoices() {
  const s = synth();
  if (!s || primed) return;
  primed = true;
  refreshVoices();
  if (s.addEventListener) s.addEventListener('voiceschanged', refreshVoices);
  else s.onvoiceschanged = refreshVoices;
  // Ba'zi brauzerlar `voiceschanged`ni umuman yubormaydi — bir necha marta qo'shimcha so'raymiz
  [300, 1200, 3000].forEach((ms) => setTimeout(refreshVoices, ms));
}

/** Ovozlar ro'yxati o'zgarganda (kech yuklanganda) chaqiriladi. Qaytaradi: obunani bekor qilish funksiyasi. */
export function onVoicesChanged(fn) {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
}

function allVoices() {
  const s = synth();
  const list = (s && s.getVoices && s.getVoices()) || [];
  if (list.length) voiceCache = list;
  return voiceCache;
}

const normLang = (v) => String(v.lang || '').toLowerCase().replace('_', '-');

export function getVoicesFor(lang) {
  const prefix = prefixOf(lang);
  const list = allVoices().filter((v) => normLang(v).startsWith(prefix));
  // Mahalliy (internetsiz ishlaydigan) ovozlar oldinda: ular telefonda barqarorroq
  return [...list].sort((a, b) => Number(!!b.localService) - Number(!!a.localService));
}

/** Telefonda shu til uchun ovoz bormi? true/false; ovozlar ro'yxati hali yuklanmagan bo'lsa — null (noma'lum). */
export function hasVoiceFor(lang) {
  const all = allVoices();
  if (!all.length) return null;
  return getVoicesFor(lang).length > 0;
}

function pickVoice(lang, voiceURI) {
  const voices = allVoices();
  if (voiceURI) {
    const chosen = voices.find((x) => x.voiceURI === voiceURI);
    if (chosen) return chosen;
  }
  const want = langToBCP47(lang).toLowerCase();
  const exact = voices.filter((v) => normLang(v) === want);
  const pool = exact.length ? exact : getVoicesFor(lang);
  return pool.find((v) => v.localService) || pool.find((v) => v.default) || pool[0] || null;
}

function makeUtterance(text, lang, { rate = 0.9, voiceURI } = {}) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langToBCP47(lang);
  u.rate = Math.min(1.5, Math.max(0.5, Number(rate) || 0.9));
  u.volume = 1;
  const v = pickVoice(lang, voiceURI);
  if (v) {
    u.voice = v;
    if (v.lang) u.lang = String(v.lang).replace('_', '-'); // Android ovozlari "ru_RU" ko'rinishida beradi
  }
  return u;
}

// ---------------------------------------------------------------------------
// Matnni bo'laklarga ajratish
// ---------------------------------------------------------------------------
/** Matnni gaplarga (va juda uzun gaplarni ≤ maxLen belgili bo'laklarga) ajratadi. Har bir bo'lak asl matndagi o'rni (start) bilan qaytadi. */
export function splitSpeechChunks(text, maxLen = 180, offset = 0) {
  const src = String(text || '').slice(offset);
  const chunks = [];
  const re = /[^.!?…\n]+(?:[.!?…]+|\n|$)\s*/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let piece = m[0];
    let start = m.index;
    while (piece.length > maxLen) {
      let cut = piece.lastIndexOf(' ', maxLen);
      if (cut < maxLen * 0.4) cut = maxLen;
      if (piece.slice(0, cut).trim()) chunks.push({ text: piece.slice(0, cut), start: start + offset });
      piece = piece.slice(cut);
      start += cut;
    }
    if (piece.trim()) chunks.push({ text: piece, start: start + offset });
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// O'qish
// ---------------------------------------------------------------------------
const live = new Set(); // GC'dan himoya: o'qilayotgan obyektlar tugamaguncha xotirada qoladi
let activeStop = null; // hozir ishlayotgan o'qish zanjirini to'xtatadi (yangisi boshlanganda)

/** Matnni bo'laklab ketma-ket o'qiydi.
 *  opts: { rate, voiceURI, startAt (matndagi belgi indeksi), onChunk(startIndex, i), onEnd(), onError(code) }.
 *  Qaytaradi: to'xtatish funksiyasi (to'xtatilganda onEnd chaqirilmaydi). */
export function speakChunks(text, lang, opts = {}) {
  const s = synth();
  const { rate = 0.9, voiceURI, startAt = 0, onChunk, onEnd, onError } = opts;
  if (!s || !String(text || '').trim()) {
    onEnd?.();
    return () => {};
  }
  if (activeStop) activeStop();
  const chunks = splitSpeechChunks(text, 180, startAt);
  if (!chunks.length) {
    onEnd?.();
    return () => {};
  }

  let stopped = false;
  let i = 0;
  let timer = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (activeStop === stop) activeStop = null;
    try {
      s.cancel();
    } catch {
      /* e'tiborsiz */
    }
  };
  const end = (fn, arg) => {
    stopped = true;
    clearTimeout(timer);
    if (activeStop === stop) activeStop = null;
    fn?.(arg);
  };

  const next = () => {
    if (stopped) return;
    if (i >= chunks.length) {
      end(onEnd);
      return;
    }
    const c = chunks[i++];
    onChunk?.(c.start, i - 1);
    const u = makeUtterance(c.text, lang, { rate, voiceURI });
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      live.delete(u);
      if (stopped) return;
      if (err === 'canceled' || err === 'interrupted') {
        // Boshqa joyda cancel() chaqirilgan — jimgina to'xtaymiz (keyingi qadamga o'tmaymiz)
        stopped = true;
        if (activeStop === stop) activeStop = null;
        return;
      }
      if (err) {
        end(onError, err);
        return;
      }
      next();
    };
    u.onend = () => done();
    u.onerror = (e) => done((e && e.error) || 'error');
    live.add(u);
    // Qotib qolgan bo'lakni (ba'zi telefonlarda onend kelmaydi) kuzatamiz
    const watchdog = Math.max(5000, Math.ceil(c.text.length / (u.rate * 8)) * 1000 + 4000);
    timer = setTimeout(() => {
      try {
        s.cancel();
      } catch {
        /* e'tiborsiz */
      }
      done();
    }, watchdog);
    try {
      if (s.paused) s.resume(); // Android'da oldingi cancel() dan keyin "pauza" holati qolib ketishi mumkin
      s.speak(u);
    } catch {
      done('error');
    }
  };

  activeStop = stop;
  // cancel() dan keyin darhol speak() qilinsa, Android Chrome yangi gapni tashlab yuboradi — shuning uchun qisqa kutamiz.
  // Hech narsa o'qilmayotgan bo'lsa — darhol (bosish hodisasi ichida) boshlaymiz: iPhone shuni talab qiladi.
  if (s.speaking || s.pending) {
    try {
      s.cancel();
    } catch {
      /* e'tiborsiz */
    }
    timer = setTimeout(next, 90);
  } else {
    next();
  }
  return stop;
}

/** Telefonda shu tilda ovoz bo'lmasa, interfeysga xabar beradi (VoiceHint komponenti tinglaydi). */
function warnIfNoVoice(lang) {
  if (typeof window === 'undefined') return;
  if (hasVoiceFor(lang) === false) window.dispatchEvent(new CustomEvent('tts-novoice', { detail: { lang } }));
}

/** Bitta so'z/gapni o'qiydi (talaffuz tugmalari uchun). Qaytaradi: to'xtatish funksiyasi. */
export function speakSimple(text, lang, opts = {}) {
  if (!isSpeechSupported() || !text) return () => {};
  warnIfNoVoice(lang);
  return speakChunks(text, lang, opts);
}

/** Bitta gapni o'qiydi va tugaganda (yoki xatoda) onEnd chaqiradi (rolli o'qish uchun). To'xtatilsa onEnd chaqirilmaydi. */
export function speakWithEnd(text, lang, { rate = 0.9, voiceURI } = {}, onEnd) {
  if (!isSpeechSupported() || !text) {
    onEnd?.();
    return () => {};
  }
  warnIfNoVoice(lang);
  return speakChunks(text, lang, { rate, voiceURI, onEnd, onError: () => onEnd?.() });
}

/** Bir nechta gapni ketma-ket o'qiydi (masalan butun dialog). onLine(i) — hozir o'qilayotgan qator.
 *  Qaytaradi: to'xtatish funksiyasi. */
export function speakSequence(lines, lang, { rate = 0.9, voiceURI, onLine, onEnd } = {}) {
  if (!isSpeechSupported() || !lines.length) {
    onEnd?.();
    return () => {};
  }
  warnIfNoVoice(lang);
  let stopped = false;
  let stopCurrent = () => {};
  let gap = null;
  const next = (i) => {
    if (stopped) return;
    if (i >= lines.length) {
      onLine?.(-1);
      onEnd?.();
      return;
    }
    onLine?.(i);
    stopCurrent = speakChunks(lines[i], lang, {
      rate,
      voiceURI,
      onEnd: () => {
        gap = setTimeout(() => next(i + 1), 350);
      },
      onError: () => next(i + 1),
    });
  };
  next(0);
  return () => {
    stopped = true;
    clearTimeout(gap);
    stopCurrent();
    onLine?.(-1);
  };
}

/** Hozir o'qilayotgan hamma narsani to'xtatadi. */
export function stopSpeaking() {
  if (activeStop) activeStop();
  else {
    try {
      synth()?.cancel();
    } catch {
      /* e'tiborsiz */
    }
  }
}

// ---------------------------------------------------------------------------
// iPhone/iPad: ovozni birinchi bosishda "ochish"
// ---------------------------------------------------------------------------
function isIOSLike() {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

let unlocked = false;
/** iOS Safari ovozli o'qishni faqat foydalanuvchi bosganidan keyin ruxsat beradi. Birinchi bosishda ovozsiz (jim) gap o'qib, qulfni ochamiz —
 *  shundan keyin masalan yangi savol chiqqanda avtomatik o'qish ham ishlaydi. */
export function unlockSpeech() {
  const s = synth();
  if (!s || unlocked || !isIOSLike()) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  } catch {
    /* e'tiborsiz */
  }
}

// ---------------------------------------------------------------------------
// Mikrofon orqali gapni tanish
// ---------------------------------------------------------------------------
/** Mikrofon orqali gapni taniydi (brauzer qo'llab-quvvatlasa). */
export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** SpeechRecognition xato kodini tushunarli xabarga aylantiradi ('' — xabar kerak emas). */
export function speechErrorText(code) {
  switch (code) {
    case 'aborted':
      return '';
    case 'not-allowed':
    case 'service-not-allowed':
      return t("Mikrofonga ruxsat berilmagan. Brauzer manzil satridagi 🔒 belgisini bosing → Sayt sozlamalari → Mikrofon → Ruxsat berish.");
    case 'no-speech':
      return t("Ovoz eshitilmadi. Telefonni og'zingizga yaqinroq tutib, qayta urinib ko'ring.");
    case 'audio-capture':
      return t("Mikrofon topilmadi yoki band. Boshqa ilova mikrofondan foydalanmayotganini tekshiring.");
    case 'network':
      return t("Ovozni tanish uchun internet kerak. Ulanishni tekshirib, qayta urinib ko'ring.");
    case 'language-not-supported':
      return t("Bu til uchun ovozni tanish telefoningizda qo'llab-quvvatlanmaydi.");
    default:
      return t("Ovozni tanib bo'lmadi. Qayta urinib ko'ring.");
  }
}

// ---------------------------------------------------------------------------
// So'zlarni ajratib ko'rsatish (TtsReader)
// ---------------------------------------------------------------------------
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
