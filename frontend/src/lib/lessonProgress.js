// Dars progressi, faollik (XP, streak) va mashq natijalari bilan ishlash.
// Barcha ma'lumot foydalanuvchining progress.state (jsonb) obyektida saqlanadi.

export const QUIZ_PASS_THRESHOLD = 60;

// Dars bosqichlari — qat'iy ketma-ketlikda: har biri oldingisi bajarilgach ochiladi.
export const STEP_KEYS = ['grammar', 'vocab', 'dialog', 'exercises', 'answers', 'teacher'];

const EMPTY_FLAGS = Object.fromEntries(STEP_KEYS.map((k) => [k, false]));

/** "admin" yoki "superadmin" rollarining ikkalasi ham to'liq huquqqa ega. */
export function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin';
}

export function getReviewFlags(progress, lang, monthId) {
  return { ...EMPTY_FLAGS, ...(progress.reviewFlags?.[lang]?.[monthId] || {}) };
}

export function getQuizResult(progress, lang, monthId) {
  return progress.testResults?.[lang]?.[monthId] || null;
}

export function getQuizPct(progress, lang, monthId) {
  const r = getQuizResult(progress, lang, monthId);
  if (!r || !r.total) return null;
  return Math.round((r.correct / r.total) * 100);
}

export function isQuizPassed(progress, lang, monthId) {
  const pct = getQuizPct(progress, lang, monthId);
  return pct !== null && pct >= QUIZ_PASS_THRESHOLD;
}

/** Oy to'liq yakunlandimi — barcha bosqichlar bajarilgan VA testdan kamida 60% olingan. */
export function isMonthDone(progress, lang, monthId) {
  const rf = getReviewFlags(progress, lang, monthId);
  return STEP_KEYS.every((key) => !!rf[key]) && isQuizPassed(progress, lang, monthId);
}

/** Darsdagi bajarilgan qadamlar ulushi (0..1) — test ham bitta qadam sifatida hisoblanadi. */
export function monthProgressRatio(progress, lang, monthId) {
  const rf = getReviewFlags(progress, lang, monthId);
  const done = STEP_KEYS.filter((k) => rf[k]).length + (isQuizPassed(progress, lang, monthId) ? 1 : 0);
  return done / (STEP_KEYS.length + 1);
}

/** Til bo'yicha barcha oylarni (modullar tartibida) tekis ro'yxatga aylantiradi. */
export function flattenMonths(modules) {
  const list = [];
  modules.forEach((mod) => {
    mod.months.forEach((month) => {
      list.push({ ...month, moduleId: mod.id, moduleTitle: mod.title });
    });
  });
  return list;
}

/** Berilgan oy ochiqmi (avvalgi oy to'liq yakunlanganmi). Adminlar uchun hammasi ochiq. */
export function isMonthUnlocked(progress, lang, flatMonths, index, isAdmin = false) {
  if (isAdmin) return true;
  if (index <= 0) return true;
  return isMonthDone(progress, lang, flatMonths[index - 1].id);
}

export function sumAiStats(progress) {
  const aiStats = progress.aiStats || {};
  return Object.values(aiStats).reduce(
    (acc, s) => ({ attempts: acc.attempts + (s.attempts || 0), correct: acc.correct + (s.correct || 0) }),
    { attempts: 0, correct: 0 }
  );
}

export function countCompletedMonths(progress, lang = null) {
  let count = 0;
  const rfAll = progress.reviewFlags || {};
  Object.keys(rfAll).forEach((l) => {
    if (lang && l !== lang) return;
    Object.keys(rfAll[l] || {}).forEach((monthId) => {
      if (isMonthDone(progress, l, monthId)) count += 1;
    });
  });
  return count;
}

// ---------------------------------------------------------------------------
// FAOLLIK: XP va kunlik streak
// ---------------------------------------------------------------------------
export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** progress obyektiga XP qo'shadi (updateProgress ichida ishlatiladi). Faqat oxirgi 90 kun saqlanadi. */
export function withActivity(prev, xp, extra = {}) {
  const key = todayKey();
  const activity = { ...(prev.activity || {}) };
  const day = { ...(activity[key] || { xp: 0, answers: 0, lessons: 0 }) };
  day.xp += xp;
  day.answers += extra.answers || 0;
  day.lessons += extra.lessons || 0;
  activity[key] = day;
  const keys = Object.keys(activity).sort();
  while (keys.length > 90) delete activity[keys.shift()];
  return { ...prev, activity, xpTotal: (prev.xpTotal || 0) + xp };
}

export function getStreak(progress) {
  const activity = progress.activity || {};
  let streak = 0;
  const d = new Date();
  // Bugun hali mashq qilinmagan bo'lsa ham, kechagi streak uzilmagan hisoblanadi
  if (!activity[todayKey(d)]) d.setDate(d.getDate() - 1);
  while (activity[todayKey(d)]?.xp > 0) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function lastNDays(progress, n = 7) {
  const activity = progress.activity || {};
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = todayKey(d);
    out.push({ key, day: d.getDay(), xp: activity[key]?.xp || 0 });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const DAILY_GOAL_XP = 30;

// ---------------------------------------------------------------------------
// MASHQ NATIJALARI ("Natijalar" sahifasi) va xatolar banki
// ---------------------------------------------------------------------------
const HISTORY_LIMIT = 40;
const BANK_LIMIT = 400;

/** Mashq sessiyasini tarixga va xatolar bankiga yozadi.
 *  session: { id, lang, at, source, label, mode, total, answered, correct, early, durationSec,
 *             mistakes: [{w,t,m,g,qm,s,st}], skipped: [{w,t,m}], okList: [[w,m]] } */
export function withPracticeSession(prev, session) {
  const history = [session, ...(prev.practiceHistory || [])].slice(0, HISTORY_LIMIT);
  const bank = { ...(prev.mistakeBank || {}) };
  const langBank = { ...(bank[session.lang] || {}) };
  (session.mistakes || []).forEach((it) => {
    const old = langBank[it.w] || { w: it.w, m: it.m, t: it.t || '', n: 0 };
    langBank[it.w] = { ...old, m: it.m, s: it.s || old.s, st: it.st || old.st, n: old.n + 1, at: session.at };
  });
  (session.okList || []).forEach(([w]) => {
    if (!langBank[w]) return;
    const n = langBank[w].n - 1;
    if (n <= 0) delete langBank[w];
    else langBank[w] = { ...langBank[w], n };
  });
  const entries = Object.values(langBank).sort((a, b) => (b.at || 0) - (a.at || 0));
  bank[session.lang] = Object.fromEntries(entries.slice(0, BANK_LIMIT).map((e) => [e.w, e]));
  return { ...prev, practiceHistory: history, mistakeBank: bank };
}

export function removeFromMistakeBank(prev, lang, word) {
  const bank = { ...(prev.mistakeBank || {}) };
  const langBank = { ...(bank[lang] || {}) };
  delete langBank[word];
  bank[lang] = langBank;
  return { ...prev, mistakeBank: bank };
}

export function getMistakeBank(progress, lang) {
  return Object.values(progress.mistakeBank?.[lang] || {}).sort((a, b) => b.n - a.n);
}
