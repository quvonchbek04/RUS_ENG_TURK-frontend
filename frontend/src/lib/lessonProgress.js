// Bir "dars" (oy) to'liq yakunlangan deb hisoblanishi uchun barcha bosqichlar
// ketma-ket bajarilgan va test (viktorina)dan kamida 60% ball olingan bo'lishi kerak.

export const QUIZ_PASS_THRESHOLD = 60;

// Dars bosqichlari — qat'iy ketma-ketlikda: har biri oldingisi bajarilgach ochiladi.
// MUHIM: bu ro'yxat MonthPage.jsx dagi STEPS bilan bir xil kalitlarga ega bo'lishi kerak,
// aks holda "oy to'liq bajarildi" tekshiruvi ba'zi bosqichlarni e'tiborsiz qoldiradi.
export const STEP_KEYS = ['grammar', 'vocab', 'dialog', 'exercises', 'answers', 'teacher'];

const EMPTY_FLAGS = Object.fromEntries(STEP_KEYS.map((k) => [k, false]));

/** "admin" yoki "superadmin" rollarining ikkalasi ham to'liq huquqqa ega hisoblanadi. */
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

/** Oy to'liq yakunlandimi — barcha bosqichlar (grammatika, lug'at, dialog, mashqlar,
 *  javoblar, o'qituvchi tavsiyasi) bajarilgan VA testdan kamida 60% olingan bo'lishi shart. */
export function isMonthDone(progress, lang, monthId) {
  const rf = getReviewFlags(progress, lang, monthId);
  const allStepsDone = STEP_KEYS.every((key) => !!rf[key]);
  return allStepsDone && isQuizPassed(progress, lang, monthId);
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

/** Berilgan oy ochiqmi (avvalgi oy to'liq yakunlanganmi) — birinchi oy har doim ochiq.
 *  Admin/superadmin uchun barcha darslar har doim ochiq hisoblanadi. */
export function isMonthUnlocked(progress, lang, flatMonths, index, isAdmin = false) {
  if (isAdmin) return true;
  if (index <= 0) return true;
  const prev = flatMonths[index - 1];
  return isMonthDone(progress, lang, prev.id);
}

/** Barcha tillar bo'yicha AI ustoz mashqlarining umumiy urinish/to'g'ri sonini yig'adi. */
export function sumAiStats(progress) {
  const aiStats = progress.aiStats || {};
  return Object.values(aiStats).reduce(
    (acc, s) => ({ attempts: acc.attempts + (s.attempts || 0), correct: acc.correct + (s.correct || 0) }),
    { attempts: 0, correct: 0 }
  );
}

/** Progress obyektidagi reviewFlags/testResults asosida, kontentsiz, umumiy tugatilgan oylar sonini hisoblaydi. */
export function countCompletedMonths(progress) {
  let count = 0;
  const rfAll = progress.reviewFlags || {};
  Object.keys(rfAll).forEach((lang) => {
    Object.keys(rfAll[lang] || {}).forEach((monthId) => {
      if (isMonthDone(progress, lang, monthId)) count += 1;
    });
  });
  return count;
}
