import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PracticeResult, { resultPct } from '../components/PracticeResult.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { EmptyState, LangChips, LANG_BY_KEY, PageHeader, StatCard, formatDateTime } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getMistakeBank, removeFromMistakeBank } from '../lib/lessonProgress.js';
import { MODES } from '../lib/practice.js';
import { readingHint } from '../lib/translit.js';

export default function ResultsPage() {
  const { progress, updateProgress } = useAuth();
  const [params, setParams] = useSearchParams();
  const [lang, setLang] = useState('all');
  const [tab, setTab] = useState('history');
  const history = useMemo(() => progress.practiceHistory || [], [progress.practiceHistory]);
  const selectedId = params.get('id');
  const selected = history.find((r) => r.id === selectedId);

  const filtered = useMemo(() => (lang === 'all' ? history : history.filter((r) => r.lang === lang)), [history, lang]);
  const totals = useMemo(() => {
    const t = filtered.reduce((s, r) => s + (r.total || 0), 0);
    const c = filtered.reduce((s, r) => s + (r.correct || 0), 0);
    const m = filtered.reduce((s, r) => s + (r.mistakes || []).length, 0);
    return { sessions: filtered.length, total: t, correct: c, mistakes: m, pct: t ? Math.round((c / t) * 100) : null };
  }, [filtered]);

  const bankLangs = lang === 'all' ? ['en', 'ru', 'tr'] : [lang];
  const bank = bankLangs.flatMap((l) => getMistakeBank(progress, l).map((x) => ({ ...x, lang: l })));

  if (selected) {
    return (
      <Layout>
        <div className="page-narrow">
          <button type="button" className="back-link mb-4" onClick={() => setParams({})}>
            ← Barcha natijalar
          </button>
          <div className="mb-4">
            <div className="eyebrow">
              {LANG_BY_KEY[selected.lang]?.flag} {selected.label}
            </div>
            <div className="text-sm muted">{MODES[selected.mode]?.label || 'Aralash'}</div>
          </div>
          <PracticeResult
            record={selected}
            showHistoryLink={false}
            extraActions={
              <Link to={`/lang/${selected.lang}/practice-full?source=mistakes`} className="btn btn-gold">
                🩹 Barcha xatolarim bilan mashq
              </Link>
            }
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page">
        <PageHeader eyebrow="Natija" title="Natijalar va xatolar" subtitle="Har bir mashq natijasi saqlanadi: qaysi so'zlarda xato qilganingiz alohida ko'rsatiladi va keyingi mashqlarda takrorlanadi." />

        <div className="mb-5">
          <LangChips value={lang} onChange={setLang} withAll />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon="🧾" label="Mashqlar" value={totals.sessions} />
          <StatCard icon="🎯" label="O'rtacha aniqlik" value={totals.pct == null ? '—' : `${totals.pct}%`} tone="sky" />
          <StatCard icon="✅" label="To'g'ri javoblar" value={totals.correct} tone="gold" />
          <StatCard icon="🩹" label="Xatolar banki" value={bank.length} tone="brick" />
        </div>

        <div className="tabs mb-4">
          <button type="button" className={`chip ${tab === 'history' ? 'chip-active' : ''}`} onClick={() => setTab('history')}>
            📊 Mashqlar tarixi · {filtered.length}
          </button>
          <button type="button" className={`chip ${tab === 'bank' ? 'chip-active' : ''}`} onClick={() => setTab('bank')}>
            🩹 Xato qilingan so'zlar · {bank.length}
          </button>
        </div>

        {tab === 'history' &&
          (filtered.length === 0 ? (
            <EmptyState icon="📊" title="Hali natija yo'q" text="Lug'at mashqi yoki dars testini bajaring — natijalar shu yerda paydo bo'ladi." action={<Link to="/lang/en/practice-full" className="btn btn-primary">Mashqni boshlash</Link>} />
          ) : (
            <div className="space-y-2.5">
              {filtered.map((r) => {
                const p = resultPct(r);
                return (
                  <button key={r.id} type="button" onClick={() => setParams({ id: r.id })} className="card card-hover p-4 w-full text-left flex items-center gap-4">
                    <span className="text-2xl">{LANG_BY_KEY[r.lang]?.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate" style={{ color: 'var(--ink)' }}>
                        {r.label}
                      </div>
                      <div className="text-xs muted">
                        {formatDateTime(r.at)} · {MODES[r.mode]?.label || 'Aralash'} · {r.answered}/{r.planned || r.total} javob
                        {r.early ? ' · to\'xtatilgan' : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-xl font-semibold" style={{ color: p >= 70 ? 'var(--pine)' : p >= 50 ? 'var(--gold)' : 'var(--brick)' }}>
                        {p}%
                      </div>
                      <div className="text-[11px] muted">{(r.mistakes || []).length} xato</div>
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-3"
                onClick={() => {
                  if (!confirm('Mashqlar tarixini tozalaysizmi? (Xatolar banki saqlanib qoladi)')) return;
                  updateProgress((prev) => ({ ...prev, practiceHistory: lang === 'all' ? [] : (prev.practiceHistory || []).filter((r) => r.lang !== lang) }));
                }}
              >
                🧹 Tarixni tozalash
              </button>
            </div>
          ))}

        {tab === 'bank' &&
          (bank.length === 0 ? (
            <EmptyState icon="🎉" title="Xato qilingan so'z yo'q" text="Mashqlarda xato qilgan so'zlaringiz shu yerga yig'iladi. To'g'ri javob bergan sari ro'yxatdan chiqib boradi." />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {bankLangs.map((l) => {
                  const n = bank.filter((x) => x.lang === l).length;
                  return n ? (
                    <Link key={l} to={`/lang/${l}/practice-full?source=mistakes`} className="btn btn-gold btn-sm">
                      {LANG_BY_KEY[l].flag} {n} ta so'z ustida mashq
                    </Link>
                  ) : null;
                })}
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {bank.map((x) => {
                  const hint = readingHint(x.w, x.lang) || x.t;
                  return (
                    <div key={x.lang + x.w} className="card-soft p-3.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                            {x.w}
                          </span>
                          {hint && hint !== x.w && <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>{hint}</span>}
                        </div>
                        <div className="text-sm muted">{x.m}</div>
                        {x.s && <div className="text-xs italic mt-1" style={{ color: 'var(--ink)' }}>{x.s}</div>}
                        <span className="badge badge-brick mt-1.5">{x.n} marta xato</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <SpeakButton text={x.w} lang={x.lang} />
                        <button type="button" className="w-8 h-8 rounded-full text-xs muted" title="Ro'yxatdan olib tashlash" onClick={() => updateProgress((prev) => removeFromMistakeBank(prev, x.lang, x.w))}>
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ))}
      </div>
    </Layout>
  );
}
