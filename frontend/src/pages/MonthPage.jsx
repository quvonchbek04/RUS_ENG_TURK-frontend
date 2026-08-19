import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import AiTaskWidget from '../components/AiTaskWidget.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getQuizPct, getQuizResult, getReviewFlags, isMonthDone, isQuizPassed, isAdminRole, STEP_KEYS } from '../lib/lessonProgress.js';

// Dars bosqichlari — qat'iy ketma-ketlikda: har biri oldingisi TO'LIQ bajarilgach ochiladi.
// (Kalitlar tartibi lessonProgress.js dagi STEP_KEYS bilan bir xil bo'lishi shart.)
const STEP_ORDER = STEP_KEYS;

const STEPS = [
  { key: 'grammar', icon: '📐', label: 'Grammatika bilan tanishdim' },
  { key: 'vocab', icon: '📚', label: "Lug'atni ko'rib chiqdim" },
  { key: 'dialog', icon: '🎧', label: "Dialogni ko'rib chiqdim" },
  { key: 'exercises', icon: '✏️', label: 'Mashqlarni bajardim' },
  { key: 'answers', icon: '🗝️', label: 'Javoblarni tekshirdim' },
  { key: 'teacher', icon: '🧑\u200d🏫', label: "O'qituvchi tavsiyasini o'qidim" },
];

// Har bir bosqich tugagach ko'rinadigan "Keyingisi →" tugmasi — bosilganda shu bosqich
// bajarilgan deb belgilanadi va navbatdagi ochiq bosqichga avtomatik o'tiladi.
// Har bir mashqni saytning o'zida bajarish uchun: foydalanuvchi javobini yozadi,
// so'ng "Javobni ko'rsatish" tugmasi bilan to'g'ri javobni solishtirib ko'radi.
// Yozilgan javob progress ichida saqlanadi (sahifani yangilasa ham yo'qolmaydi).
function ExerciseItem({ index, question, answer, savedValue, onSave }) {
  const [value, setValue] = useState(savedValue || '');
  const [revealed, setRevealed] = useState(false);

  return (
    <li className="rounded-xl border p-3.5" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
      <div className="flex gap-3 text-sm mb-2.5">
        <span className="font-mono shrink-0" style={{ color: 'var(--gold)' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ color: 'var(--ink)' }}>{question}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        placeholder="Javobingizni shu yerga yozing…"
        rows={2}
        className="w-full rounded-lg border p-2.5 text-sm mb-2"
        style={{ marginLeft: '1.75rem', width: 'calc(100% - 1.75rem)', borderColor: 'var(--line)', background: 'var(--paper-soft)', color: 'var(--ink)' }}
      />
      <div style={{ marginLeft: '1.75rem' }} className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg cursor-pointer"
          style={{ background: revealed ? 'var(--success-bg)' : 'var(--paper-soft)', color: revealed ? 'var(--pine)' : 'var(--ink-soft)' }}
        >
          {revealed ? '🙈 Javobni yashirish' : "👁 To'g'ri javobni ko'rsatish"}
        </button>
        {revealed && answer && (
          <div className="text-sm px-3 py-1.5 rounded-lg flex-1 min-w-[160px]" style={{ background: 'var(--success-bg)', color: 'var(--ink)' }}>
            {answer}
          </div>
        )}
      </div>
    </li>
  );
}

function NextStepButton({ label = 'Keyingisi →', onClick }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full py-3 rounded-xl font-mono text-sm uppercase tracking-widest font-semibold cursor-pointer transition-colors"
      style={{ background: 'var(--pine)', color: 'var(--paper)' }}
    >
      {label}
    </button>
  );
}

export default function MonthPage() {
  const { lang, moduleId, monthId } = useParams();
  const { progress, updateProgress, user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const [data, setData] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [error, setError] = useState('');
  const autoOpenedForRef = useRef(null);

  useEffect(() => {
    setData(null);
    setOpenKey(null);
    autoOpenedForRef.current = null;
    api.content(lang).then(setData).catch((e) => setError(e.message));
  }, [lang, monthId]);

  const { mod, month } = useMemo(() => {
    if (!data) return {};
    const mod = data.modules.find((m) => m.id === moduleId);
    const month = mod?.months.find((mo) => mo.id === monthId);
    return { mod, month };
  }, [data, moduleId, monthId]);

  const reviewFlags = getReviewFlags(progress, lang, monthId);
  const quizResult = getQuizResult(progress, lang, monthId);
  const quizPct = getQuizPct(progress, lang, monthId);
  const quizPassed = isQuizPassed(progress, lang, monthId);
  const done = isMonthDone(progress, lang, monthId);

  function isStepUnlocked(key) {
    if (isAdmin) return true;
    const idx = STEP_ORDER.indexOf(key);
    if (idx <= 0) return true;
    return !!reviewFlags[STEP_ORDER[idx - 1]];
  }
  const quizUnlocked = isAdmin || !!reviewFlags[STEP_ORDER[STEP_ORDER.length - 1]];

  // Dars birinchi marta ochilganda (yoki foydalanuvchi "Lug'at mashqi"dan qaytganda) —
  // hali bajarilmagan birinchi ochiq bosqichni avtomatik ochib qo'yadi, shunda
  // foydalanuvchi har safar qo'lda qidirib o'tirmasin.
  useEffect(() => {
    if (!month) return;
    if (autoOpenedForRef.current === monthId) return;
    autoOpenedForRef.current = monthId;
    const firstIncomplete = STEP_ORDER.find((k) => !reviewFlags[k]);
    setOpenKey(firstIncomplete || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, monthId]);

  function toggleStep(key) {
    if (!isStepUnlocked(key)) return;
    setOpenKey((cur) => (cur === key ? null : key));
  }

  // Bosqichni "bajarildi" deb belgilaydi va navbatdagi hali bajarilmagan bosqichga
  // avtomatik o'tadi (agar hammasi bajarilgan bo'lsa — akkordionni yopadi).
  function advanceToNext(key) {
    const newFlags = { ...reviewFlags, [key]: true };
    updateProgress((prev) => {
      const reviewFlagsAll = { ...(prev.reviewFlags || {}) };
      const langMap = { ...(reviewFlagsAll[lang] || {}) };
      const monthFlags = { ...(langMap[monthId] || {}) };
      monthFlags[key] = true;
      langMap[monthId] = monthFlags;
      reviewFlagsAll[lang] = langMap;
      return { ...prev, reviewFlags: reviewFlagsAll };
    });
    const idx = STEP_ORDER.indexOf(key);
    const next = STEP_ORDER.slice(idx + 1).find((k) => !newFlags[k]);
    setOpenKey(next || null);
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-5 py-16 text-center" style={{ color: 'var(--brick)' }}>
          {error}
        </div>
      </Layout>
    );
  }

  if (!data || !month) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-5 py-16 font-mono text-sm" style={{ color: 'var(--ink-soft)' }}>
          Yuklanmoqda…
        </div>
      </Layout>
    );
  }

  function renderStepBody(key) {
    if (key === 'grammar' && month.grammar) {
      return (
        <div className="pt-1 pb-4 px-1">
          <h3 className="font-display text-lg font-semibold mb-2" style={{ color: 'var(--ink)' }}>
            {month.grammar.title}
          </h3>
          <p className="leading-relaxed mb-4 text-sm" style={{ color: 'var(--ink)' }}>
            {month.grammar.text}
          </p>
          {month.grammar.examples?.length > 0 && (
            <div className="space-y-1.5">
              {month.grammar.examples.map((ex, i) => (
                <div key={i} className="font-mono text-sm flex gap-2">
                  <span style={{ color: 'var(--pine)' }}>{ex[0]}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>— {ex[1]}</span>
                </div>
              ))}
            </div>
          )}
          <AiTaskWidget
            type="text"
            content={`${month.grammar.title}\n${month.grammar.text}\n${(month.grammar.examples || []).map((ex) => ex.join(' — ')).join('\n')}`}
            lang={lang}
          />
          {!reviewFlags.grammar && (
            <NextStepButton onClick={() => advanceToNext('grammar')} label="Grammatikani o'rgandim, keyingisi →" />
          )}
        </div>
      );
    }

    if (key === 'vocab') {
      const attempted = !!quizResult;
      return (
        <div className="pt-1 pb-4 px-1">
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {month.vocab.map(([word, translit, meaning], i) => (
              <div
                key={i}
                className="rounded-xl border p-3.5 flex items-start gap-3"
                style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                    {word}
                  </div>
                  <div className="font-mono text-xs mb-1" style={{ color: 'var(--gold)' }}>
                    {translit}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                    {meaning}
                  </div>
                </div>
                <SpeakButton text={word} lang={lang} />
              </div>
            ))}
          </div>

          <AiTaskWidget
            type="text"
            content={`Bu oyning so'zlari:\n${month.vocab.map(([w, , m]) => `${w} — ${m}`).join('\n')}`}
            lang={lang}
          />

          {!attempted ? (
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--gold)', background: 'var(--gold-soft)' }}>
              <div className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
                Majburiy qadam
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--ink)' }}>
                Davom etishdan oldin, yuqoridagi so'zlarni yodda saqlab, lug'at mashqini bajaring.
              </p>
              <Link
                to={`/lang/${lang}/practice/${moduleId}/${monthId}`}
                className="inline-block px-6 py-3 rounded-xl font-mono text-sm uppercase tracking-widest font-semibold cursor-pointer"
                style={{ background: 'var(--gold)', color: 'var(--panel)' }}
              >
                🔀 Lug'at mashqini boshlash
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--pine)', background: 'var(--success-bg)' }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  ✅ Lug'at mashqi bajarildi — natija: {quizPct}%
                </div>
                <Link
                  to={`/lang/${lang}/practice/${moduleId}/${monthId}`}
                  className="font-mono text-xs uppercase tracking-widest px-3 py-2 rounded-lg cursor-pointer"
                  style={{ background: 'var(--panel)', color: 'var(--ink-soft)', border: '1px solid var(--line)' }}
                >
                  Qayta mashq qilish
                </Link>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (key === 'dialog' && month.dialog) {
      return (
        <div className="pt-1 pb-4 px-1">
          <h3 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--ink)' }}>
            {month.dialog.title}
          </h3>
          <div className="space-y-3">
            {month.dialog.lines.map(([speaker, line, tr], i) => (
              <div key={i} className="flex gap-3 items-start">
                <span
                  className="font-mono text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}
                >
                  {speaker}
                </span>
                <div className="flex-1 min-w-0">
                  <div style={{ color: 'var(--ink)' }}>{line}</div>
                  <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                    {tr}
                  </div>
                </div>
                <SpeakButton text={line} lang={lang} />
              </div>
            ))}
          </div>
          <AiTaskWidget
            type="dialog"
            content={`${month.dialog.title}\n${month.dialog.lines.map(([s, l, tr]) => `${s}: ${l} (${tr})`).join('\n')}`}
            lang={lang}
          />
          {!reviewFlags.dialog && (
            <NextStepButton onClick={() => advanceToNext('dialog')} label="Dialogni ko'rib chiqdim, keyingisi →" />
          )}
        </div>
      );
    }

    if (key === 'exercises') {
      const savedAnswers = progress.exerciseAnswers?.[lang]?.[monthId] || {};
      function saveAnswer(i, text) {
        updateProgress((prev) => {
          const all = { ...(prev.exerciseAnswers || {}) };
          const langMap = { ...(all[lang] || {}) };
          const monthMap = { ...(langMap[monthId] || {}) };
          monthMap[i] = text;
          langMap[monthId] = monthMap;
          all[lang] = langMap;
          return { ...prev, exerciseAnswers: all };
        });
      }
      return (
        <div className="pt-1 pb-4 px-1">
          <ol className="space-y-3">
            {month.exercises?.map((ex, i) => (
              <ExerciseItem
                key={i}
                index={i}
                question={ex}
                answer={month.answers?.[i]}
                savedValue={savedAnswers[i]}
                onSave={(text) => saveAnswer(i, text)}
              />
            ))}
          </ol>
          <AiTaskWidget
            type="text"
            content={`Mashqlar:\n${(month.exercises || []).join('\n')}`}
            lang={lang}
          />
          {!reviewFlags.exercises && (
            <NextStepButton onClick={() => advanceToNext('exercises')} label="Mashqlarni bajardim, keyingisi →" />
          )}
        </div>
      );
    }

    if (key === 'answers') {
      return (
        <div className="pt-1 pb-4 px-1">
          <ol className="space-y-2">
            {month.answers?.map((a, i) => (
              <li
                key={i}
                className="rounded-xl border p-3.5 flex gap-3 text-sm"
                style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              >
                <span className="font-mono shrink-0" style={{ color: 'var(--pine)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {a}
              </li>
            ))}
          </ol>
          {!reviewFlags.answers && (
            <NextStepButton onClick={() => advanceToNext('answers')} label="Javoblarni tekshirdim, keyingisi →" />
          )}
        </div>
      );
    }

    if (key === 'teacher') {
      return (
        <div className="pt-1 pb-4 px-1">
          <div
            className="rounded-xl border p-4 leading-relaxed text-sm"
            style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
          >
            {month.teacher}
          </div>
          <AiTaskWidget type="text" content={month.teacher || ''} lang={lang} />
          {!reviewFlags.teacher && (
            <NextStepButton onClick={() => advanceToNext('teacher')} label="O'qidim, testga o'tish →" />
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Link to={`/lang/${lang}`} className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          ← {mod.title}
        </Link>

        <div className="mt-4 mb-6">
          <div className="font-mono text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--gold)' }}>
            {month.label}
          </div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            {month.topic}
          </h1>
        </div>

        {done ? (
          <div
            className="rounded-xl border p-4 mb-6 text-center font-mono text-xs uppercase tracking-widest"
            style={{ borderColor: 'var(--pine)', background: 'var(--pine)', color: 'var(--paper)' }}
          >
            🎉 Dars to'liq yakunlandi — keyingi dars ochildi!
          </div>
        ) : (
          <div
            className="rounded-xl border p-4 mb-6 text-sm"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink-soft)' }}
          >
            Dars bosqichlari qat'iy ketma-ketlikda ochiladi: grammatika → lug'at (+ majburiy
            lug'at mashqi) → dialog → mashqlar → javoblar → o'qituvchiga. Har birini to'liq
            ko'rib chiqib, "Keyingisi" tugmasini bosing — keyingi bosqich avtomatik ochiladi.
            Oxirida testdan kamida 60% ball oling.
          </div>
        )}

        {month.tasks?.length > 0 && (
          <div className="rounded-xl border p-4 mb-6" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--ink-soft)' }}>
              Oy vazifalari
            </div>
            <ul className="space-y-1.5">
              {month.tasks.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--ink)' }}>
                  <span className="font-mono" style={{ color: 'var(--gold)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ketma-ket, majburiy tartibda ochiladigan bosqichlar — akkordion */}
        <div className="space-y-3">
          {STEPS.map((item) => {
            const on = !!reviewFlags[item.key];
            const unlocked = isStepUnlocked(item.key);
            const open = openKey === item.key;
            return (
              <div
                key={item.key}
                className="rounded-xl border overflow-hidden transition-colors"
                style={{
                  borderColor: open ? 'var(--pine)' : on ? 'var(--pine)' : 'var(--line)',
                  background: on ? 'var(--success-bg)' : 'var(--panel)',
                }}
              >
                <button
                  disabled={!unlocked}
                  onClick={() => toggleStep(item.key)}
                  className="w-full p-3.5 flex items-center gap-3 text-left transition-colors"
                  style={{ opacity: unlocked ? 1 : 0.5, cursor: unlocked ? 'pointer' : 'not-allowed' }}
                >
                  <span className="text-xl shrink-0">{unlocked ? item.icon : '🔒'}</span>
                  <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {item.label}
                  </span>
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs shrink-0"
                    style={{ background: on ? 'var(--pine)' : 'var(--paper-soft)', color: on ? 'var(--paper)' : 'var(--ink-soft)' }}
                  >
                    {on ? '✓' : '○'}
                  </span>
                  <span className="font-mono text-xs shrink-0" style={{ color: 'var(--ink-soft)' }}>
                    {unlocked ? (open ? '▲' : '▼') : ''}
                  </span>
                </button>
                {open && unlocked && (
                  <div className="border-t" style={{ borderColor: 'var(--line)' }}>
                    {renderStepBody(item.key)}
                  </div>
                )}
              </div>
            );
          })}

          {quizUnlocked ? (
            <Link
              to={`/lang/${lang}/practice/${moduleId}/${monthId}`}
              className="rounded-xl border p-3.5 flex items-center gap-3 text-left cursor-pointer transition-colors"
              style={{
                borderColor: quizPassed ? 'var(--pine)' : 'var(--line)',
                background: quizPassed ? 'var(--success-bg)' : 'var(--panel)',
              }}
            >
              <span className="text-xl shrink-0">🧪</span>
              <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Test (kamida 60%)
                <span className="block font-mono text-[11px] font-normal mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {quizPct === null ? 'Hali topshirilmagan' : `Oxirgi natija: ${quizPct}%`}
                </span>
              </span>
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs shrink-0"
                style={{ background: quizPassed ? 'var(--pine)' : 'var(--paper-soft)', color: quizPassed ? 'var(--paper)' : 'var(--ink-soft)' }}
              >
                {quizPassed ? '✓' : '○'}
              </span>
            </Link>
          ) : (
            <div
              className="rounded-xl border p-3.5 flex items-center gap-3 text-left opacity-50"
              style={{ borderColor: 'var(--line)', background: 'var(--panel)', cursor: 'not-allowed' }}
            >
              <span className="text-xl shrink-0">🔒</span>
              <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Test (kamida 60%)
                <span className="block font-mono text-[11px] font-normal mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  Avval barcha bosqichlarni yakunlang
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
