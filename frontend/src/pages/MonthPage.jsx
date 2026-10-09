import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { GrammarMore, DialogExtra, DialogView, ReadingBlock, WordsExplorer, Flashcards } from '../components/LessonExtras.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import AiTaskWidget from '../components/AiTaskWidget.jsx';
import MediaViewer from '../components/MediaViewer.jsx';
import { Modal, PageLoading, ProgressBar } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useContent } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTutor, useTutorContext } from '../context/TutorContext.jsx';
import { MEDIA_META } from '../lib/media.js';
import { readingHint } from '../lib/translit.js';
import {
  flattenMonths,
  getQuizPct,
  getReviewFlags,
  isAdminRole,
  isMonthDone,
  isQuizPassed,
  monthProgressRatio,
  QUIZ_PASS_THRESHOLD,
  STEP_KEYS,
  withActivity,
} from '../lib/lessonProgress.js';

const STEPS = [
  { key: 'grammar', icon: '📐', label: 'Grammatika', done: 'Grammatikani o\'rgandim' },
  { key: 'vocab', icon: '📚', label: "Lug'at", done: "So'zlarni o'rgandim" },
  { key: 'dialog', icon: '🎧', label: 'Dialog', done: "Dialogni tingladim" },
  { key: 'exercises', icon: '✏️', label: 'Mashqlar', done: 'Mashqlarni bajardim' },
  { key: 'answers', icon: '🗝️', label: 'Javoblar', done: 'Javoblarni tekshirdim' },
  { key: 'teacher', icon: '🧑‍🏫', label: 'Tavsiya', done: "O'qidim" },
  { key: 'test', icon: '🧪', label: 'Test', done: '' },
];

function ExerciseItem({ index, question, answer, savedValue, onSave, lang }) {
  const [value, setValue] = useState(savedValue || '');
  const [revealed, setRevealed] = useState(false);
  const [ai, setAi] = useState(null);
  const [checking, setChecking] = useState(false);

  async function aiCheck() {
    if (!value.trim()) return;
    setChecking(true);
    try {
      const res = await api.aiCheck({ context: question, question, answer: value, lang, sample: answer });
      setAi(res);
    } catch (e) {
      setAi({ correct: false, feedback: e.message });
    } finally {
      setChecking(false);
    }
  }

  return (
    <li className="card-soft p-4">
      <div className="flex gap-3 text-[15px] mb-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}>
          {index + 1}
        </span>
        <span style={{ color: 'var(--ink)' }}>{question}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        placeholder="Javobingizni shu yerga yozing…"
        rows={2}
        className="textarea !min-h-[64px] mb-2"
      />
      <div className="flex flex-wrap items-start gap-2">
        <button type="button" onClick={() => setRevealed((v) => !v)} className="btn btn-ghost btn-sm">
          {revealed ? '🙈 Yashirish' : "👁 To'g'ri javob"}
        </button>
        <button type="button" onClick={aiCheck} disabled={checking || !value.trim()} className="btn btn-soft btn-sm">
          {checking ? <span className="spinner" /> : '🤖'} AI tekshirsin
        </button>
      </div>
      {revealed && answer && <div className="alert alert-success mt-2 text-sm">{answer}</div>}
      {ai && (
        <div className={`alert mt-2 text-sm ${ai.correct ? 'alert-success' : 'alert-error'}`} style={{ color: 'var(--ink)' }}>
          {ai.correct ? '✅ ' : '❌ '}
          {ai.feedback}
          {ai.corrected && <div className="mt-1 font-semibold">To'g'ri: {ai.corrected}</div>}
        </div>
      )}
    </li>
  );
}

export default function MonthPage() {
  const { lang, moduleId, monthId } = useParams();
  const navigate = useNavigate();
  const { progress, updateProgress, user } = useAuth();
  const { ask } = useTutor();
  const isAdmin = isAdminRole(user?.role);
  const { data, error } = useContent(lang);
  const [stepKey, setStepKey] = useState(null);
  const [vocabView, setVocabView] = useState('list');
  const [materials, setMaterials] = useState([]);
  const [openMaterial, setOpenMaterial] = useState(null);
  const topRef = useRef(null);

  const { mod, month, flat } = useMemo(() => {
    if (!data) return {};
    const mod = data.modules.find((m) => m.id === moduleId);
    const month = mod?.months.find((mo) => mo.id === monthId);
    return { mod, month, flat: flattenMonths(data.modules) };
  }, [data, moduleId, monthId]);

  useTutorContext(
    month
      ? {
          lang,
          title: `${month.label}: ${month.topic}`,
          text: [
            month.grammar ? `Grammatika: ${month.grammar.title}. ${month.grammar.text}` : '',
            `So'zlar: ${(month.vocab || []).map((v) => `${v[0]} — ${v[2]}`).join('; ')}`,
            month.dialog ? `Dialog: ${month.dialog.lines.map((l) => l[1]).join(' ')}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        }
      : null
  );

  const reviewFlags = getReviewFlags(progress, lang, monthId);
  const quizPct = getQuizPct(progress, lang, monthId);
  const quizPassed = isQuizPassed(progress, lang, monthId);
  const done = isMonthDone(progress, lang, monthId);

  function isUnlocked(key) {
    if (isAdmin) return true;
    if (key === 'test') return STEP_KEYS.every((k) => reviewFlags[k]);
    const idx = STEP_KEYS.indexOf(key);
    return idx <= 0 || !!reviewFlags[STEP_KEYS[idx - 1]];
  }

  // Dars ochilganda — birinchi bajarilmagan bosqichni avtomatik tanlaymiz
  useEffect(() => {
    if (!month) return;
    const first = STEP_KEYS.find((k) => !reviewFlags[k]);
    setStepKey(first || 'test');
    setVocabView('list');
    api.listMedia({ lang, lessonRef: monthId }).then(setMaterials).catch(() => setMaterials([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month?.id]);

  function goto(key) {
    if (!isUnlocked(key)) return;
    setStepKey(key);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function completeAndNext(key) {
    if (!reviewFlags[key]) {
      updateProgress((prev) => {
        const all = { ...(prev.reviewFlags || {}) };
        const langMap = { ...(all[lang] || {}) };
        langMap[monthId] = { ...(langMap[monthId] || {}), [key]: true };
        all[lang] = langMap;
        return withActivity({ ...prev, reviewFlags: all }, 10);
      });
    }
    const idx = STEPS.findIndex((s) => s.key === key);
    const next = STEPS[idx + 1];
    if (next) {
      setStepKey(next.key);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
  if (!data || !stepKey) return <Layout><PageLoading /></Layout>;
  if (!month) {
    return (
      <Layout>
        <div className="page-narrow">
          <div className="alert alert-error">Dars topilmadi.</div>
        </div>
      </Layout>
    );
  }

  const flatIdx = flat.findIndex((m) => m.id === monthId);
  const nextLesson = flat[flatIdx + 1];
  const ratio = monthProgressRatio(progress, lang, monthId);
  const stepIdx = STEPS.findIndex((s) => s.key === stepKey);
  const step = STEPS[stepIdx];
  const prevStep = STEPS[stepIdx - 1];
  const nextStep = STEPS[stepIdx + 1];
  const lessonItems = [
    ...(month.vocab || []).map(([w, t, m]) => ({ w, t: t !== w ? t : '', m })),
    ...(month.words || []).slice(0, 40).map(([w, m, s, st]) => ({ w, m, s, st })),
  ];

  function renderStep() {
    if (stepKey === 'grammar') {
      return (
        <>
          {month.tasks?.length > 0 && (
            <div className="card-soft p-4 mb-5">
              <div className="text-[11px] font-bold uppercase tracking-wider muted mb-2">🎯 Dars maqsadlari</div>
              <ul className="space-y-1.5">
                {month.tasks.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--ink)' }}>
                    <span style={{ color: 'var(--gold)' }}>●</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {month.grammar && (
            <>
              <h3 className="h2 mb-2">{month.grammar.title}</h3>
              <p className="leading-relaxed mb-4 text-[15px]" style={{ color: 'var(--ink)' }}>
                {month.grammar.text}
              </p>
              {month.grammar.examples?.length > 0 && (
                <div className="space-y-2">
                  {month.grammar.examples.map((ex, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5" style={{ background: 'var(--pine-soft)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold" style={{ color: 'var(--ink)' }}>
                          {ex[0]}
                        </div>
                        {readingHint(ex[0], lang) && <div className="font-mono text-[11px] faint">{readingHint(ex[0], lang)}</div>}
                        <div className="text-sm muted">{ex[1]}</div>
                      </div>
                      <SpeakButton text={ex[0].replace(/[A-ZА-Я]{2,}/g, (s) => s.toLowerCase())} lang={lang} />
                    </div>
                  ))}
                </div>
              )}
              <GrammarMore items={month.grammar.more} />
              <AiTaskWidget
                type="text"
                content={`${month.grammar.title}\n${month.grammar.text}\n${(month.grammar.examples || []).map((ex) => ex.join(' — ')).join('\n')}`}
                lang={lang}
                title="Grammatika bo'yicha AI vazifa"
              />
            </>
          )}
        </>
      );
    }

    if (stepKey === 'vocab') {
      return (
        <>
          <div className="tabs mb-4">
            {[
              ['list', "📋 Ro'yxat"],
              ['cards', '🃏 Kartochkalar'],
            ].map(([k, l]) => (
              <button key={k} type="button" className={`chip ${vocabView === k ? 'chip-active' : ''}`} onClick={() => setVocabView(k)}>
                {l}
              </button>
            ))}
            <Link to={`/lang/${lang}/practice-full?source=lesson&lesson=${monthId}`} className="chip">
              🔀 Mashq qilish
            </Link>
          </div>
          {vocabView === 'cards' ? (
            <Flashcards items={lessonItems} lang={lang} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {month.vocab.map(([word, translit, meaning], i) => (
                <div key={i} className="card-soft p-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-[17px]" style={{ color: 'var(--ink)' }}>
                      {word}
                    </div>
                    {translit && translit !== word && (
                      <div className="font-mono text-xs mb-0.5" style={{ color: 'var(--gold)' }}>
                        {translit}
                      </div>
                    )}
                    <div className="text-sm muted">{meaning}</div>
                  </div>
                  <SpeakButton text={word} lang={lang} />
                </div>
              ))}
            </div>
          )}
          <WordsExplorer words={month.words} phrases={month.phrases} lang={lang} wordCats={data.wordCats} phraseCats={data.phraseCats} />
          <AiTaskWidget type="text" content={`Bu darsning so'zlari:\n${month.vocab.map(([w, , m]) => `${w} — ${m}`).join('\n')}`} lang={lang} title="So'zlar bo'yicha AI vazifa" />
        </>
      );
    }

    if (stepKey === 'dialog') {
      return (
        <>
          {month.dialog && <DialogView title={month.dialog.title} lines={month.dialog.lines} lang={lang} />}
          <DialogExtra dialog={month.dialog2} lang={lang} />
          <ReadingBlock reading={month.reading} lang={lang} />
          {month.dialog && (
            <AiTaskWidget
              type="dialog"
              content={`${month.dialog.title}\n${month.dialog.lines.map(([s, l, tr]) => `${s}: ${l} (${tr})`).join('\n')}`}
              lang={lang}
              title="Dialog bo'yicha AI vazifa"
            />
          )}
        </>
      );
    }

    if (stepKey === 'exercises') {
      const saved = progress.exerciseAnswers?.[lang]?.[monthId] || {};
      const saveAnswer = (i, text) =>
        updateProgress((prev) => {
          const all = { ...(prev.exerciseAnswers || {}) };
          const langMap = { ...(all[lang] || {}) };
          langMap[monthId] = { ...(langMap[monthId] || {}), [i]: text };
          all[lang] = langMap;
          return { ...prev, exerciseAnswers: all };
        });
      return (
        <ol className="space-y-3">
          {month.exercises?.map((ex, i) => (
            <ExerciseItem key={i} index={i} question={ex} answer={month.answers?.[i]} savedValue={saved[i]} onSave={(t) => saveAnswer(i, t)} lang={lang} />
          ))}
        </ol>
      );
    }

    if (stepKey === 'answers') {
      return (
        <ol className="space-y-2">
          {month.answers?.map((a, i) => (
            <li key={i} className="card-soft p-3.5 flex gap-3 text-[15px]" style={{ color: 'var(--ink)' }}>
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--pine-soft)', color: 'var(--pine)' }}>
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="text-xs muted mb-0.5">{month.exercises?.[i]}</div>
                {a}
              </div>
            </li>
          ))}
        </ol>
      );
    }

    if (stepKey === 'teacher') {
      return (
        <>
          <div className="card-soft p-4 leading-relaxed text-[15px]" style={{ color: 'var(--ink)' }}>
            {month.teacher}
          </div>
          <button type="button" className="btn btn-soft mt-4" onClick={() => ask(`"${month.topic}" mavzusi bo'yicha qanday qilib samarali mashq qilsam bo'ladi? Menga reja tuzib ber.`)}>
            🤖 AI ustozdan shaxsiy reja so'rash
          </button>
        </>
      );
    }

    // TEST
    return (
      <div className="text-center py-4">
        <div className="text-5xl mb-3">{quizPassed ? '🏆' : '🧪'}</div>
        <h3 className="h2 mb-2">{quizPassed ? 'Test topshirildi!' : 'Yakuniy test'}</h3>
        <p className="muted max-w-md mx-auto mb-5">
          Dars so'zlari bo'yicha aralash test (tanlash, tinglash, yozish). Darsni yakunlash uchun kamida {QUIZ_PASS_THRESHOLD}% to'g'ri javob kerak.
          {quizPct !== null && (
            <>
              <br />
              Oxirgi natija: <b style={{ color: quizPassed ? 'var(--pine)' : 'var(--brick)' }}>{quizPct}%</b>
            </>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to={`/lang/${lang}/practice/${moduleId}/${monthId}`} className="btn btn-brand btn-lg">
            {quizPct === null ? 'Testni boshlash →' : '↺ Qayta topshirish'}
          </Link>
          {done && nextLesson && (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate(`/lang/${lang}/month/${nextLesson.moduleId}/${nextLesson.id}`)}>
              Keyingi dars: {nextLesson.topic} →
            </button>
          )}
        </div>
        {done && <div className="alert alert-success mt-6 inline-block">🎉 Dars to'liq yakunlandi — keyingi dars ochildi!</div>}
      </div>
    );
  }

  return (
    <Layout>
      <div className="page" ref={topRef}>
        <Link to={`/lang/${lang}`} className="back-link mb-3">
          ← {mod.title}
        </Link>

        <div className="flex flex-wrap items-start gap-4 mb-5">
          <div className="flex-1 min-w-[220px]">
            <div className="eyebrow mb-1">
              {data.meta.flag} {month.label}
            </div>
            <h1 className="h1">{month.topic}</h1>
          </div>
          <button type="button" className="btn btn-soft" onClick={() => ask('')}>
            🤖 Ustozdan so'rash
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <ProgressBar value={ratio * 100} className="flex-1" />
          <span className="text-xs font-bold" style={{ color: 'var(--pine)' }}>
            {Math.round(ratio * 100)}%
          </span>
        </div>

        {/* Bosqichlar navigatsiyasi */}
        <div className="tabs mb-5 -mx-1 px-1">
          {STEPS.map((s, i) => {
            const isDone = s.key === 'test' ? quizPassed : !!reviewFlags[s.key];
            const unlocked = isUnlocked(s.key);
            const active = s.key === stepKey;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!unlocked}
                onClick={() => goto(s.key)}
                className="flex items-center gap-2 rounded-2xl px-3 py-2 shrink-0 border transition-colors disabled:cursor-not-allowed"
                style={{
                  background: active ? 'var(--pine)' : isDone ? 'var(--pine-soft)' : 'var(--panel)',
                  color: active ? '#fff' : isDone ? 'var(--pine)' : unlocked ? 'var(--ink)' : 'var(--ink-faint)',
                  borderColor: active ? 'var(--pine)' : 'var(--line)',
                  opacity: unlocked ? 1 : 0.6,
                }}
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: active ? 'rgba(255,255,255,.2)' : 'var(--paper-soft)' }}>
                  {isDone ? '✓' : unlocked ? i + 1 : '🔒'}
                </span>
                <span className="text-sm font-bold whitespace-nowrap">
                  {s.icon} {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {materials.length > 0 && (
          <div className="card-soft p-3 mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider muted mr-1">📎 Dars materiallari:</span>
            {materials.map((m) => (
              <button key={m.id} type="button" className="chip !py-1.5" onClick={() => setOpenMaterial(m)}>
                {MEDIA_META[m.kind]?.icon} {m.title}
              </button>
            ))}
          </div>
        )}

        <div className="card p-4 sm:p-6 anim-rise" key={stepKey}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{step.icon}</span>
            <h2 className="h2 flex-1">{step.label}</h2>
            <span className="text-xs muted">
              {stepIdx + 1}/{STEPS.length}
            </span>
          </div>
          {renderStep()}
        </div>

        {/* Pastki navigatsiya */}
        {stepKey !== 'test' && (
          <div className="sticky-actions -mx-5 px-5 py-3 mt-5">
            <div className="flex gap-2 max-w-[1120px] mx-auto">
              {prevStep && (
                <button type="button" className="btn btn-ghost btn-lg" onClick={() => goto(prevStep.key)}>
                  ←<span className="hidden sm:inline"> {prevStep.label}</span>
                </button>
              )}
              <button type="button" className="btn btn-brand btn-lg flex-1" onClick={() => completeAndNext(stepKey)}>
                {reviewFlags[stepKey] ? `Keyingisi: ${nextStep?.label} →` : `✓ ${step.done}, keyingisi →`}
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!openMaterial} onClose={() => setOpenMaterial(null)} title={openMaterial?.title} wide>
        {openMaterial && <MediaViewer item={openMaterial} />}
      </Modal>
    </Layout>
  );
}
