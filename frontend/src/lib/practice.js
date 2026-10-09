// Lug'at mashqi mexanizmi: savollar tuzish va javobni tekshirish.
// Element (item) shakli: { w: so'z, t: o'qilishi, m: ma'nosi (o'zbekcha), s?: misol gap, st?: gap tarjimasi }

export const MODES = {
  choice: { label: "So'z → ma'no", icon: '🔤', hint: "So'zni ko'rib, to'g'ri tarjimani tanlang" },
  reverse: { label: "Ma'no → so'z", icon: '🔁', hint: "O'zbekcha ma'noga mos so'zni tanlang" },
  write: { label: 'Yozish', icon: '⌨️', hint: "Ma'noga qarab so'zni o'zingiz yozing" },
  listen: { label: 'Tinglash', icon: '🎧', hint: "So'zni eshitib, ma'nosini tanlang" },
  mixed: { label: 'Aralash', icon: '🎲', hint: 'Hamma turdagi savollar aralash' },
};

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LOCALE = { en: 'en', ru: 'ru', tr: 'tr' };

export function normalizeAnswer(s, lang) {
  return String(s || '')
    .toLocaleLowerCase(LOCALE[lang] || 'en')
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:"'«»()…“”‘’`´]/g, '')
    .replace(/[—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Takroriy so'zlarni olib tashlaydi (so'zning o'zi bo'yicha). */
export function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || !it.w || !it.m) continue;
    const key = String(it.w).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function pickDistractors(item, pool, field, n = 3) {
  const target = String(item[field]).trim().toLowerCase();
  const used = new Set([target]);
  const out = [];
  for (const cand of shuffle(pool)) {
    const v = String(cand[field] || '').trim();
    const key = v.toLowerCase();
    if (!v || used.has(key)) continue;
    used.add(key);
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

/** Savollar ro'yxatini tuzadi. pool — chalg'ituvchi variantlar olinadigan kengroq ro'yxat. */
export function buildQuestions(items, { mode = 'choice', count = 20, pool = null, keepOrder = false } = {}) {
  const source = dedupeItems(items);
  const distractorPool = dedupeItems(pool && pool.length >= 4 ? pool : source);
  const chosen = (keepOrder ? source : shuffle(source)).slice(0, count > 0 ? count : source.length);
  return chosen.map((item, idx) => {
    let qm = mode;
    if (mode === 'mixed') {
      const opts = ['choice', 'choice', 'reverse', 'listen'];
      if (String(item.w).length <= 24) opts.push('write', 'write');
      qm = opts[Math.floor(Math.random() * opts.length)];
    }
    if (qm === 'write' && String(item.w).length > 40) qm = 'choice';
    let options = null;
    if (qm === 'choice' || qm === 'listen') options = shuffle([item.m, ...pickDistractors(item, distractorPool, 'm')]);
    if (qm === 'reverse') options = shuffle([item.w, ...pickDistractors(item, distractorPool, 'w')]);
    return { id: idx, item, mode: qm, options };
  });
}

/** @returns {{ok:boolean, typo?:boolean}} */
export function checkAnswer(q, given, lang) {
  if (q.mode === 'write') {
    const g = normalizeAnswer(given, lang);
    if (!g) return { ok: false };
    const variants = String(q.item.w)
      .split(/[/;,]| yoki /)
      .map((v) => normalizeAnswer(v.replace(/\(.*?\)/g, ''), lang))
      .filter(Boolean);
    variants.push(normalizeAnswer(q.item.w, lang));
    if (variants.includes(g)) return { ok: true };
    const typo = variants.some((v) => v.length >= 5 && levenshtein(v, g) <= 1);
    return typo ? { ok: true, typo: true } : { ok: false };
  }
  const expected = q.mode === 'reverse' ? q.item.w : q.item.m;
  return { ok: given === expected };
}

export function expectedAnswer(q) {
  return q.mode === 'reverse' || q.mode === 'write' ? q.item.w : q.item.m;
}

/** Lug'at qatorlarini (har xil manbadan) yagona element shakliga keltiradi. */
export function fromVocabRow([w, t, m]) {
  return { w, t: t && t !== w ? t : '', m };
}
export function fromWordRow([w, m, s, st]) {
  return { w, t: '', m, s, st };
}
