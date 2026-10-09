import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { PageLoading, ProgressBar } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useContent } from '../lib/hooks.js';
import { flattenMonths, isAdminRole, isMonthDone, isMonthUnlocked, monthProgressRatio, getMistakeBank } from '../lib/lessonProgress.js';

export default function RoutePage() {
  const { lang } = useParams();
  const { progress, user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const { data, error } = useContent(lang);
  const [openModules, setOpenModules] = useState({});

  if (error) {
    return (
      <Layout>
        <div className="page-narrow">
          <div className="alert alert-error">{error}</div>
        </div>
      </Layout>
    );
  }
  if (!data) {
    return (
      <Layout>
        <PageLoading />
      </Layout>
    );
  }

  const flat = flattenMonths(data.modules);
  const doneCount = flat.filter((m) => isMonthDone(progress, lang, m.id)).length;
  const nextIdx = Math.max(0, flat.findIndex((m) => !isMonthDone(progress, lang, m.id)));
  const nextMonth = flat[nextIdx] || flat[flat.length - 1];
  const nextRatio = monthProgressRatio(progress, lang, nextMonth.id);
  const mistakes = getMistakeBank(progress, lang).length;
  const totalWords = (data.wordbank || []).reduce((s, c) => s + c.rows.length, 0);
  const totalPhrases = (data.phrasebank || []).reduce((s, c) => s + c.rows.length, 0);
  const currentModuleId = nextMonth.moduleId;

  return (
    <Layout>
      <div className="page-wide">
        <Link to="/" className="back-link mb-3">
          ← Bosh sahifa
        </Link>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <span className="text-5xl">{data.meta.flag}</span>
          <div className="flex-1 min-w-[220px]">
            <h1 className="h1">{data.meta.title}</h1>
            <div className="eyebrow mt-1">{data.meta.route}</div>
          </div>
          <div className="w-full sm:w-64">
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="muted">Umumiy progress</span>
              <span style={{ color: 'var(--pine)' }}>
                {doneCount}/{flat.length} dars
              </span>
            </div>
            <ProgressBar value={(doneCount / flat.length) * 100} />
          </div>
        </div>

        {/* Davom ettirish */}
        <Link to={`/lang/${lang}/month/${nextMonth.moduleId}/${nextMonth.id}`} className="hero-card p-5 sm:p-6 mb-6 flex flex-wrap items-center gap-4">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'rgba(255,255,255,.16)' }}>
            🎯
          </span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">
              {nextRatio > 0 ? 'Davom ettirish' : 'Keyingi dars'} · {nextMonth.moduleTitle} · {nextMonth.label}
            </div>
            <div className="font-display text-2xl font-semibold mt-1">{nextMonth.topic}</div>
            {nextRatio > 0 && (
              <div className="h-2 rounded-full mt-3 max-w-sm overflow-hidden" style={{ background: 'rgba(255,255,255,.22)' }}>
                <div className="h-full rounded-full" style={{ width: `${nextRatio * 100}%`, background: '#f6b867' }} />
              </div>
            )}
          </div>
          <span className="btn btn-lg" style={{ background: '#fff', color: '#0c5444' }}>
            {nextRatio > 0 ? 'Davom etish →' : 'Boshlash →'}
          </span>
        </Link>

        {/* Tezkor bo'limlar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { to: `/lang/${lang}/practice-full`, icon: '🔀', title: "Lug'at mashqi", sub: "So'z, tinglash, yozish" },
            { to: `/lang/${lang}/practice-full?source=mistakes`, icon: '🩹', title: 'Xatolar ustida ishlash', sub: `${mistakes} ta so'z` },
            { to: `/lang/${lang}/dictionary`, icon: '📖', title: "Lug'at", sub: `${totalWords} so'z · ${totalPhrases} ibora` },
            { to: `/lang/${lang}/dialogs`, icon: '🎧', title: 'Dialoglar', sub: 'Tinglash va AI vazifa' },
          ].map((a) => (
            <Link key={a.title} to={a.to} className="card card-hover p-4 flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--pine-soft)' }}>
                {a.icon}
              </span>
              <div className="min-w-0">
                <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  {a.title}
                </div>
                <div className="text-xs muted truncate">{a.sub}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bosqichlar va darslar */}
        <div className="space-y-5">
          {data.modules.map((mod, mi) => {
            const done = mod.months.filter((m) => isMonthDone(progress, lang, m.id)).length;
            const isOpen = openModules[mod.id] ?? (mod.id === currentModuleId || mi === 0);
            return (
              <section key={mod.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenModules((o) => ({ ...o, [mod.id]: !isOpen }))}
                  className="w-full text-left p-4 sm:p-5 flex items-center gap-4"
                >
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center font-display text-lg font-bold shrink-0" style={{ background: done === mod.months.length ? 'var(--pine)' : 'var(--gold-soft)', color: done === mod.months.length ? '#fff' : 'var(--gold)' }}>
                    {done === mod.months.length ? '✓' : mi + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                      {mod.title}
                    </div>
                    <div className="text-xs muted mb-2">
                      {mod.sub ? `${mod.sub} · ` : ''}
                      {done}/{mod.months.length} dars
                    </div>
                    <ProgressBar value={(done / mod.months.length) * 100} className="max-w-md" />
                  </div>
                  <span className="muted text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {mod.months.map((month) => {
                      const idx = flat.findIndex((m) => m.id === month.id);
                      const unlocked = isMonthUnlocked(progress, lang, flat, idx, isAdmin);
                      const isDone = isMonthDone(progress, lang, month.id);
                      const ratio = monthProgressRatio(progress, lang, month.id);
                      const isNext = month.id === nextMonth.id;
                      const inner = (
                        <>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider faint flex-1">{month.label}</span>
                            {isNext && !isDone && <span className="badge badge-gold">Hozirgi</span>}
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
                              style={{ background: isDone ? 'var(--pine)' : 'var(--paper-soft)', color: isDone ? '#fff' : 'var(--ink-soft)' }}
                            >
                              {isDone ? '✓' : unlocked ? '▶' : '🔒'}
                            </span>
                          </div>
                          <div className="font-display font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                            {month.topic}
                          </div>
                          <div className="text-xs muted mt-1">
                            {(month.vocab || []).length + (month.words || []).length} so'z
                            {(month.phrases || []).length ? ` · ${month.phrases.length} ibora` : ''}
                            {month.dialog ? ' · dialog' : ''}
                          </div>
                          {unlocked && !isDone && ratio > 0 && <ProgressBar value={ratio * 100} className="mt-2.5" />}
                        </>
                      );
                      return unlocked ? (
                        <Link
                          key={month.id}
                          to={`/lang/${lang}/month/${mod.id}/${month.id}`}
                          className="card-soft card-hover p-4 block"
                          style={isNext && !isDone ? { borderColor: 'var(--gold)', boxShadow: '0 0 0 3px var(--gold-soft)' } : undefined}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div key={month.id} className="card-soft p-4 opacity-55 cursor-not-allowed" title="Avvalgi darsni yakunlang">
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <p className="text-xs faint mt-5">Har bir dars oldingisi to'liq yakunlangach (barcha bosqichlar + testdan kamida 60%) ochiladi.</p>
      </div>
    </Layout>
  );
}
