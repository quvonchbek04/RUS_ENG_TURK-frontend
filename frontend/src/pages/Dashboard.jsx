import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTutor } from '../context/TutorContext.jsx';
import { useCurrentLang } from '../lib/hooks.js';
import {
  countCompletedMonths,
  DAILY_GOAL_XP,
  getMistakeBank,
  getStreak,
  lastNDays,
  sumAiStats,
  todayKey,
} from '../lib/lessonProgress.js';
import { AiText, ProgressBar, StatCard, formatDate } from '../components/ui.jsx';
import { resultPct } from '../components/PracticeResult.jsx';
import { getLang, getLocale, t } from '../i18n/index.js';

const UZ_DAY_NAMES = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/** Hafta kuni qisqa nomi (0 = yakshanba) — joriy interfeys tilida. */
function dayName(i) {
  if (getLang() === 'uz') return UZ_DAY_NAMES[i];
  try {
    return new Date(2024, 0, 7 + i).toLocaleDateString(getLocale(), { weekday: 'short' });
  } catch {
    return UZ_DAY_NAMES[i];
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return t('Xayrli tun');
  if (h < 12) return t('Xayrli tong');
  if (h < 18) return t('Xayrli kun');
  return t('Xayrli kech');
}

export default function Dashboard() {
  const { user, progress } = useAuth();
  const { setOpen } = useTutor();
  const lastLang = useCurrentLang();
  const [meta, setMeta] = useState(null);
  const [news, setNews] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.meta().then(setMeta).catch((e) => setError(e.message));
    api.latestNews(3).then(setNews).catch(() => {});
  }, []);

  const streak = getStreak(progress);
  const todayXp = progress.activity?.[todayKey()]?.xp || 0;
  const week = lastNDays(progress, 7);
  const maxXp = Math.max(DAILY_GOAL_XP, ...week.map((d) => d.xp));
  const ai = sumAiStats(progress);
  const history = useMemo(() => progress.practiceHistory || [], [progress.practiceHistory]);
  const mistakes = getMistakeBank(progress, lastLang);
  const completed = countCompletedMonths(progress);
  const accuracy = useMemo(() => {
    const total = history.reduce((s, r) => s + (r.total || 0), 0);
    const correct = history.reduce((s, r) => s + (r.correct || 0), 0);
    return total ? Math.round((correct / total) * 100) : null;
  }, [history]);

  const langs = meta ? Object.values(meta.LANGS) : [];

  return (
    <Layout>
      <div className="page-wide">
        {/* Hero */}
        <div className="hero-card p-6 sm:p-9 mb-6">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-center">
            <div>
              <div className="text-xs font-bold tracking-[0.2em] uppercase opacity-80 mb-2">{greeting()}</div>
              <h1 className="font-display text-3xl sm:text-5xl font-semibold leading-tight">
                {user?.displayName || user?.username} 👋
              </h1>
              <p className="mt-3 max-w-xl opacity-90 text-[15px]">
                {t("Bugungi maqsad — {n} XP. Dars o'ting, lug'at mashqini bajaring yoki AI ustoz bilan suhbatlashing.", { n: DAILY_GOAL_XP })}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to={`/lang/${lastLang}`} className="btn btn-lg" style={{ background: '#fff', color: '#0c5444' }}>
                  {t('▶ Darsni davom ettirish')}
                </Link>
                <Link to={`/lang/${lastLang}/practice-full`} className="btn btn-lg" style={{ background: 'rgba(255,255,255,.14)', color: '#fff', border: '1px solid rgba(255,255,255,.35)' }}>
                  {t("🔀 Lug'at mashqi")}
                </Link>
              </div>
            </div>
            <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,.12)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">{t('🔥 {n} kunlik seriya', { n: streak })}</span>
                <span className="text-sm opacity-90">
                  {todayXp}/{DAILY_GOAL_XP} XP
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,.2)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (todayXp / DAILY_GOAL_XP) * 100)}%`, background: '#f6b867' }} />
              </div>
              <div className="flex items-end justify-between gap-2 h-20">
                {week.map((d) => (
                  <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full max-w-[22px] rounded-md"
                      title={`${d.key}: ${d.xp} XP`}
                      style={{
                        height: `${Math.max(6, (d.xp / maxXp) * 64)}px`,
                        background: d.xp >= DAILY_GOAL_XP ? '#f6b867' : d.xp > 0 ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.22)',
                      }}
                    />
                    <span className="text-[10px] opacity-80">{dayName(d.day)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard icon="⭐" label={t('Jami XP')} value={progress.xpTotal || 0} tone="gold" />
          <StatCard icon="✅" label={t('Tugatilgan darslar')} value={completed} />
          <StatCard icon="🎯" label={t('Mashq aniqligi ({n})', { n: history.length })} value={accuracy == null ? '—' : `${accuracy}%`} tone="sky" />
          <StatCard icon="🤖" label={t('AI vazifalar')} value={ai.attempts ? `${ai.correct}/${ai.attempts}` : '0'} tone="brick" />
        </div>

        {error && <div className="alert alert-error mb-6">{error}</div>}

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
          <div>
            <h2 className="h2 mb-3">{t("Yo'nalishlar")}</h2>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {langs.map((l) => {
                const done = countCompletedMonths(progress, l.key);
                const total = l.lessonCount || 33;
                return (
                  <Link key={l.key} to={`/lang/${l.key}`} className="ticket-edge card card-hover p-5 block">
                    <div className="flex items-start justify-between mb-4">
                      <span className="text-4xl">{l.flag}</span>
                      <span className="badge badge-gold">{l.eyebrow?.split('·').pop()?.trim() || 'A1 — C1'}</span>
                    </div>
                    <div className="font-display text-xl font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
                      {t(l.title)}
                    </div>
                    <div className="text-xs muted mb-4 truncate">{t(l.route)}</div>
                    <ProgressBar value={(done / total) * 100} />
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="muted">{t('{a}/{b} dars', { a: done, b: total })}</span>
                      <span className="font-bold" style={{ color: 'var(--pine)' }}>
                        {done ? t('Davom etish →') : t('Boshlash →')}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {!meta && !error && [0, 1, 2].map((i) => <div key={i} className="skeleton h-48" />)}
            </div>

            <h2 className="h2 mb-3">{t('Tezkor amallar')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { to: `/lang/${lastLang}/practice-full?source=mistakes`, icon: '🩹', title: t('Xatolarim'), sub: t("{n} ta so'z", { n: mistakes.length }) },
                { to: `/lang/${lastLang}/dictionary`, icon: '📖', title: t("Lug'at"), sub: t("2161 so'z + iboralar") },
                { to: `/lang/${lastLang}/dialogs`, icon: '🎧', title: t('Dialoglar'), sub: t('Tinglang va takrorlang') },
                { to: '/media/audio', icon: '🎵', title: t('Musiqa'), sub: t("Qo'shiqlar va audio") },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="card card-hover p-4">
                  <div className="text-2xl mb-2">{a.icon}</div>
                  <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                    {a.title}
                  </div>
                  <div className="text-xs muted">{a.sub}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'var(--grad-brand)' }}>
                  🤖
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold" style={{ color: 'var(--ink)' }}>
                    {t('AI ustoz')}
                  </div>
                  <div className="text-xs muted">{t('Savol bering, gapingizni tekshirtiring')}</div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
                  {t('Ochish')}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="h2">{t('Yangiliklar')}</h2>
                <Link to="/media/news" className="text-sm font-bold" style={{ color: 'var(--pine)' }}>
                  {t('Barchasi →')}
                </Link>
              </div>
              {news.length === 0 ? (
                <div className="card-soft p-4 text-sm muted">{t("Hozircha yangilik yo'q.")}</div>
              ) : (
                <div className="space-y-3">
                  {news.map((n) => (
                    <Link key={n.id} to="/media/news" className="card card-hover p-4 block">
                      {n.fileUrl && <img src={n.fileUrl} alt="" className="w-full h-32 object-cover rounded-xl mb-3" loading="lazy" />}
                      <div className="text-[11px] faint mb-1">{formatDate(n.createdAt)}</div>
                      <div className="font-bold mb-1" style={{ color: 'var(--ink)' }}>
                        {n.title}
                      </div>
                      <div className="text-sm muted line-clamp-3">
                        <AiText text={String(n.content?.text || '').slice(0, 220)} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="h2">{t('Oxirgi natijalar')}</h2>
                <Link to="/results" className="text-sm font-bold" style={{ color: 'var(--pine)' }}>
                  {t('Barchasi →')}
                </Link>
              </div>
              {history.length === 0 ? (
                <div className="card-soft p-4 text-sm muted">{t("Hali mashq bajarilmagan. Lug'at mashqidan boshlang!")}</div>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 4).map((r) => (
                    <Link key={r.id} to={`/results?id=${r.id}`} className="card-soft p-3 flex items-center gap-3">
                      <span className="text-lg">{r.lang === 'ru' ? '🇷🇺' : r.lang === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
                          {t(r.label)}
                        </div>
                        <div className="text-xs muted">{t('{a}/{b} · {n} xato', { a: r.correct, b: r.total, n: (r.mistakes || []).length })}</div>
                      </div>
                      <span className={`badge ${resultPct(r) >= 70 ? 'badge-pine' : resultPct(r) >= 50 ? 'badge-gold' : 'badge-brick'}`}>{resultPct(r)}%</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
