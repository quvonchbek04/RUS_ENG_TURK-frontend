import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PracticeSession from '../components/PracticeSession.jsx';
import PracticeResult from '../components/PracticeResult.jsx';
import { PageHeader, PageLoading } from '../components/ui.jsx';
import { useContent } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import { flattenMonths, getMistakeBank, withActivity, withPracticeSession } from '../lib/lessonProgress.js';
import { MODES, dedupeItems } from '../lib/practice.js';
import { t } from '../i18n/index.js';

const COUNTS = [10, 20, 30, 50, 100, 0];

// Matnlar o'zbekcha kalit sifatida saqlanadi va chiqarishda t() bilan o'giriladi.
const SOURCES = [
  { key: 'all', icon: '🌍', label: "Hamma so'zlar", sub: "Kurs + 2161 so'z + qo'shimcha lug'at" },
  { key: 'course', icon: '📘', label: 'Kurs darslari', sub: "Darslardagi asosiy so'zlar" },
  { key: 'lesson', icon: '🎯', label: 'Bitta dars', sub: "Tanlangan dars so'zlari" },
  { key: 'wordcat', icon: '🗂️', label: "Mavzu bo'yicha", sub: "24 mavzu (Word fayldan)" },
  { key: 'phrases', icon: '💬', label: 'Iboralar', sub: '297 ta foydali ibora' },
  { key: 'dict', icon: '📖', label: "Qo'shimcha lug'at", sub: 'Kategoriyalar va yuklanganlar' },
  { key: 'mistakes', icon: '🩹', label: 'Xatolarim', sub: "Avval xato qilgan so'zlar" },
];

export default function VocabPracticeFull() {
  const { lang } = useParams();
  const [params, setParams] = useSearchParams();
  const { progress, updateProgress } = useAuth();
  const { data, error } = useContent(lang);

  const [source, setSource] = useState(params.get('source') === 'uploaded' ? 'dict' : params.get('source') || 'all');
  const [lessonId, setLessonId] = useState(params.get('lesson') || '');
  const [wordCat, setWordCat] = useState(0);
  const [phraseCat, setPhraseCat] = useState(-1);
  const [dictCat, setDictCat] = useState(-1);
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('til_practice_mode') || 'choice';
    } catch {
      return 'choice';
    }
  });
  const [count, setCount] = useState(20);
  const [phase, setPhase] = useState('setup'); // setup | play | result
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [retryItems, setRetryItems] = useState(null);

  const mistakes = getMistakeBank(progress, lang);
  const flat = useMemo(() => (data ? flattenMonths(data.modules) : []), [data]);

  // Yuklangan lug'at to'plamiga to'g'ridan-to'g'ri havola: ?source=uploaded&set=ID
  useEffect(() => {
    if (!data) return;
    const setId = params.get('set');
    if (setId) {
      const idx = data.dictExtra.findIndex((c) => String(c.mediaId) === setId);
      if (idx >= 0) {
        setSource('dict');
        setDictCat(idx);
      }
    }
    if (!lessonId && flat.length) setLessonId(flat[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const pools = useMemo(() => {
    if (!data) return null;
    const course = [];
    data.modules.forEach((mod) => mod.months.forEach((m) => (m.vocab || []).forEach(([w, tr, mm]) => course.push({ w, t: tr !== w ? tr : '', m: mm }))));
    const wordbank = (data.wordbank || []).map((c) => c.rows.map(([w, m, s, st]) => ({ w, m, s, st })));
    const phrasebank = (data.phrasebank || []).map((c) => c.rows.map(([w, m, s, st]) => ({ w, m, s, st })));
    const dict = (data.dictExtra || []).map((c) => c.words.map(([w, tr, m]) => ({ w, t: tr !== w ? tr : '', m })));
    return { course, wordbank, phrasebank, dict };
  }, [data]);

  // `label` — o'zbekcha (progress tarixida shu holda saqlanadi); ekranda t(label) bilan o'giriladi
  const { items, label } = useMemo(() => {
    if (!pools) return { items: [], label: '' };
    switch (source) {
      case 'course':
        return { items: pools.course, label: 'Kurs darslari' };
      case 'lesson': {
        const m = flat.find((x) => x.id === lessonId);
        if (!m) return { items: [], label: 'Dars' };
        return {
          items: [
            ...(m.vocab || []).map(([w, tr, mm]) => ({ w, t: tr !== w ? tr : '', m: mm })),
            ...(m.words || []).map(([w, mm, s, st]) => ({ w, m: mm, s, st })),
            ...(m.phrases || []).map(([w, mm, s, st]) => ({ w, m: mm, s, st })),
          ],
          label: `${m.label}: ${m.topic}`,
        };
      }
      case 'wordcat':
        return { items: pools.wordbank[wordCat] || [], label: data.wordCats[wordCat] || 'Mavzu' };
      case 'phrases':
        return phraseCat < 0 ? { items: pools.phrasebank.flat(), label: 'Iboralar' } : { items: pools.phrasebank[phraseCat] || [], label: data.phraseCats[phraseCat] || 'Iboralar' };
      case 'dict':
        return dictCat < 0 ? { items: pools.dict.flat(), label: "Qo'shimcha lug'at" } : { items: pools.dict[dictCat] || [], label: data.dictExtra[dictCat]?.cat || "Lug'at" };
      case 'mistakes':
        return { items: mistakes.map((x) => ({ w: x.w, t: x.t, m: x.m, s: x.s, st: x.st })), label: 'Xatolarim' };
      default:
        return { items: [...pools.course, ...pools.wordbank.flat(), ...pools.dict.flat()], label: "Hamma so'zlar" };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools, source, lessonId, wordCat, phraseCat, dictCat, mistakes.length]);

  const distractorPool = useMemo(() => {
    if (!pools) return [];
    return source === 'phrases' ? pools.phrasebank.flat() : [...pools.course, ...pools.wordbank.flat()];
  }, [pools, source]);

  const uniqueCount = useMemo(() => dedupeItems(items).length, [items]);

  const onFinish = useCallback(
    (record) => {
      setResult(record);
      setPhase('result');
      updateProgress((prev) => {
        const vocabStats = { ...(prev.vocabStats || {}) };
        const s = { ...(vocabStats[lang] || { attempts: 0, correct: 0 }) };
        s.attempts += record.answered;
        s.correct += record.correct;
        vocabStats[lang] = s;
        return withActivity(withPracticeSession({ ...prev, vocabStats }, record), record.correct, { answers: record.answered });
      });
    },
    [lang, updateProgress]
  );

  function start() {
    try {
      localStorage.setItem('til_practice_mode', mode);
    } catch {
      /* e'tiborsiz */
    }
    setRetryItems(null);
    setResult(null);
    setRound((r) => r + 1);
    setPhase('play');
  }

  if (error) {
    return (
      <Layout>
        <div className="page-narrow">
          <div className="alert alert-error">{error}</div>
        </div>
      </Layout>
    );
  }
  if (!data || !pools)
    return (
      <Layout>
        <PageLoading />
      </Layout>
    );

  if (phase === 'play') {
    return (
      <Layout>
        <div className="page-narrow">
          <PracticeSession
            key={round}
            items={retryItems || items}
            pool={distractorPool}
            lang={lang}
            mode={mode}
            count={retryItems ? 0 : count}
            title={retryItems ? 'Xatolar ustida ishlash' : label}
            source={retryItems ? 'mistakes' : source}
            label={retryItems ? `Xatolar ustida: ${label}` : label}
            onFinish={onFinish}
            onExit={() => setPhase('setup')}
          />
        </div>
      </Layout>
    );
  }

  if (phase === 'result' && result) {
    return (
      <Layout>
        <div className="page-narrow">
          <button type="button" className="back-link mb-4" onClick={() => setPhase('setup')}>
            {t('← Mashq sozlamalari')}
          </button>
          <PracticeResult
            record={result}
            onRetryMistakes={(list) => {
              setRetryItems(list.map((x) => ({ w: x.w, t: x.t, m: x.m, s: x.s, st: x.st })));
              setResult(null);
              setRound((r) => r + 1);
              setPhase('play');
            }}
            onRestart={start}
          />
        </div>
      </Layout>
    );
  }

  // ---------- SOZLAMALAR ----------
  return (
    <Layout>
      <div className="page">
        <PageHeader
          back={{ to: `/lang/${lang}`, label: t(data.meta.title) }}
          eyebrow={t("Lug'at mashqi")}
          title={t('Mashqni sozlang')}
          subtitle={t("Manba, savol turi va sonini tanlang. Istalgan payt «To'xtatish» tugmasini bossangiz — natija va xatolaringiz alohida ko'rsatiladi.")}
        />

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          <div className="space-y-6">
            <section>
              <div className="label">{t("1. So'zlar manbasi")}</div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {SOURCES.map((s) => {
                  const active = source === s.key;
                  const disabled = s.key === 'mistakes' && mistakes.length === 0;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSource(s.key);
                        setParams({}, { replace: true });
                      }}
                      className="card p-3.5 text-left flex items-center gap-3 transition-colors disabled:opacity-50"
                      style={active ? { borderColor: 'var(--pine)', boxShadow: '0 0 0 3px var(--pine-soft)' } : undefined}
                    >
                      <span className="text-2xl">{s.icon}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                          {t(s.label)}
                          {s.key === 'mistakes' && <span className="badge badge-brick ml-1.5">{mistakes.length}</span>}
                        </div>
                        <div className="text-xs muted truncate">{t(s.sub)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {source === 'lesson' && (
                <select className="select mt-3" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                  {flat.map((m) => (
                    <option key={m.id} value={m.id}>
                      {t(m.moduleTitle)} · {t(m.label)} · {t(m.topic)}
                    </option>
                  ))}
                </select>
              )}
              {source === 'wordcat' && (
                <select className="select mt-3" value={wordCat} onChange={(e) => setWordCat(Number(e.target.value))}>
                  {(data.wordbank || []).map((c, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {t(c.title)} ({c.rows.length})
                    </option>
                  ))}
                </select>
              )}
              {source === 'phrases' && (
                <select className="select mt-3" value={phraseCat} onChange={(e) => setPhraseCat(Number(e.target.value))}>
                  <option value={-1}>{t('Barcha iboralar')}</option>
                  {(data.phrasebank || []).map((c, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {t(c.title)} ({c.rows.length})
                    </option>
                  ))}
                </select>
              )}
              {source === 'dict' && (
                <select className="select mt-3" value={dictCat} onChange={(e) => setDictCat(Number(e.target.value))}>
                  <option value={-1}>{t('Barcha kategoriyalar')}</option>
                  {(data.dictExtra || []).map((c, i) => (
                    <option key={i} value={i}>
                      {t(c.cat)} ({c.words.length})
                    </option>
                  ))}
                </select>
              )}
            </section>

            <section>
              <div className="label">{t('2. Savol turi')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(MODES).map(([k, m]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMode(k)}
                    className="card p-3 text-left"
                    style={mode === k ? { borderColor: 'var(--pine)', boxShadow: '0 0 0 3px var(--pine-soft)' } : undefined}
                  >
                    <div className="text-xl mb-1">{m.icon}</div>
                    <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                      {m.label}
                    </div>
                    <div className="text-[11px] muted leading-snug">{m.hint}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="label">{t('3. Savollar soni')}</div>
              <div className="tabs">
                {COUNTS.map((c) => (
                  <button key={c} type="button" className={`chip ${count === c ? 'chip-active' : ''}`} onClick={() => setCount(c)}>
                    {c === 0 ? t('Barchasi ({n})', { n: uniqueCount }) : c}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="card p-5 lg:sticky lg:top-6">
              <div className="eyebrow mb-1">{t('Tanlangan')}</div>
              <div className="h2 mb-1">{t(label)}</div>
              <div className="text-sm muted mb-4">
                {t("{a} ta so'z · {mode} · {b} ta savol", { a: uniqueCount, mode: MODES[mode].label, b: count === 0 ? uniqueCount : Math.min(count, uniqueCount) })}
              </div>
              <button type="button" className="btn btn-brand btn-lg btn-block" disabled={uniqueCount < 2} onClick={start}>
                {t('▶ Mashqni boshlash')}
              </button>
              {uniqueCount < 2 && <div className="help">{t("Bu manbada mashq uchun yetarli so'z yo'q.")}</div>}
              <div className="divider my-4" />
              <Link to="/results" className="btn btn-ghost btn-block">
                {t('📊 Natijalar va xatolar tarixi')}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
