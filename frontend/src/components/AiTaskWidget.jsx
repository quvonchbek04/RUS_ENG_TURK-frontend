import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTutor } from '../context/TutorContext.jsx';
import { withActivity } from '../lib/lessonProgress.js';
import { AiText } from './ui.jsx';

const KINDS = [
  { key: 'auto', label: '🎲 Avtomatik' },
  { key: 'translate', label: '🔁 Tarjima' },
  { key: 'compose', label: '✍️ Gap tuzish' },
  { key: 'fill', label: '🧩 Bo\'sh joy' },
  { key: 'question', label: '❓ Savol-javob' },
  { key: 'grammar', label: '📐 Grammatika' },
];

// type: 'text' | 'dialog'   content: material matni   lang: 'ru' | 'en' | 'tr'
export default function AiTaskWidget({ type = 'text', content, lang, title = 'AI ustoz vazifasi', level }) {
  const { updateProgress } = useAuth();
  const { ask } = useTutor();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('auto');
  const [task, setTask] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [asked, setAsked] = useState([]);
  const [score, setScore] = useState({ done: 0, ok: 0 });

  function recordStat(isCorrect) {
    updateProgress((prev) => {
      const aiStats = { ...(prev.aiStats || {}) };
      const s = { ...(aiStats[lang] || { attempts: 0, correct: 0 }) };
      s.attempts += 1;
      if (isCorrect) s.correct += 1;
      aiStats[lang] = s;
      return withActivity({ ...prev, aiStats }, isCorrect ? 5 : 1, { answers: 1 });
    });
  }

  async function requestTask() {
    setOpen(true);
    setLoading(true);
    setError('');
    setFeedback(null);
    setAnswer('');
    setShowHint(false);
    setShowSample(false);
    try {
      const res = await api.aiTask({ type, content, lang, taskKind: kind === 'auto' ? undefined : kind, level, avoid: asked });
      setTask(res);
      setAsked((a) => [...a, res.question].slice(-6));
    } catch (e) {
      setError(e.message || 'Vazifa olishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setChecking(true);
    setError('');
    try {
      const res = await api.aiCheck({ context: content, question: task?.question, answer, lang, sample: task?.sample });
      setFeedback(res);
      setScore((s) => ({ done: s.done + 1, ok: s.ok + (res.correct ? 1 : 0) }));
      recordStat(Boolean(res.correct));
    } catch (e) {
      setError(e.message || 'Javobni tekshirishda xatolik yuz berdi');
    } finally {
      setChecking(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-5 rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: 'var(--sky-soft)' }}>
        <span className="text-2xl">🤖</span>
        <div className="flex-1 min-w-[180px]">
          <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
            {title}
          </div>
          <div className="text-xs muted">AI shu material asosida shaxsiy vazifa beradi va javobingizni tekshiradi</div>
        </div>
        <button type="button" onClick={requestTask} className="btn btn-primary btn-sm">
          Vazifa olish
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 card p-4 sm:p-5" style={{ borderColor: 'color-mix(in srgb, var(--sky) 35%, var(--line))' }}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="badge badge-sky">🤖 {title}</span>
        {score.done > 0 && (
          <span className="badge badge-pine">
            ✓ {score.ok}/{score.done}
          </span>
        )}
        <button type="button" className="ml-auto text-xs muted underline" onClick={() => setOpen(false)}>
          yig'ish
        </button>
      </div>

      <div className="tabs mb-3">
        {KINDS.map((k) => (
          <button key={k.key} type="button" className={`chip !py-1.5 !text-xs ${kind === k.key ? 'chip-active' : ''}`} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm muted py-4">
          <span className="spinner" /> Vazifa tayyorlanmoqda…
        </div>
      )}

      {!loading && task && (
        <>
          <div className="rounded-xl p-3.5 mb-3 text-[15px] leading-relaxed" style={{ background: 'var(--panel-2)', color: 'var(--ink)' }}>
            <AiText text={task.question} />
          </div>
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            {task.hint && (
              <button type="button" className="font-bold" style={{ color: 'var(--gold)' }} onClick={() => setShowHint((v) => !v)}>
                💡 {showHint ? 'Maslahatni yashirish' : 'Maslahat'}
              </button>
            )}
            {task.sample && (
              <button type="button" className="font-bold" style={{ color: 'var(--pine)' }} onClick={() => setShowSample((v) => !v)}>
                👁 {showSample ? 'Namunani yashirish' : "Namunaviy javob"}
              </button>
            )}
            <button type="button" className="font-bold" style={{ color: 'var(--sky)' }} onClick={() => ask(`Bu vazifani tushunmadim, yordam ber: ${task.question}`)}>
              💬 Ustozdan so'rash
            </button>
          </div>
          {showHint && task.hint && <div className="alert alert-warn mb-3 text-sm">{task.hint}</div>}
          {showSample && task.sample && <div className="alert alert-success mb-3 text-sm">{task.sample}</div>}

          {!feedback && (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Javobingizni shu yerga yozing…"
                rows={3}
                className="textarea mb-2"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={submitAnswer} disabled={checking || !answer.trim()} className="btn btn-primary">
                  {checking ? <><span className="spinner" /> Tekshirilmoqda…</> : 'Tekshirish'}
                </button>
                <button type="button" onClick={requestTask} className="btn btn-ghost">
                  🔁 Boshqa vazifa
                </button>
              </div>
            </>
          )}

          {feedback && (
            <div>
              <div
                className="rounded-xl p-3.5 text-sm mb-2 flex items-start gap-2.5"
                style={{ background: feedback.correct ? 'var(--success-bg)' : 'var(--error-bg)', color: 'var(--ink)' }}
              >
                <span className="text-lg shrink-0">{feedback.correct ? '✅' : '❌'}</span>
                <div className="flex-1 min-w-0">
                  {typeof feedback.score === 'number' && (
                    <div className="font-bold mb-1" style={{ color: feedback.correct ? 'var(--pine)' : 'var(--brick)' }}>
                      Baho: {feedback.score}/100
                    </div>
                  )}
                  <AiText text={feedback.feedback} />
                </div>
              </div>
              {feedback.corrected && (
                <div className="rounded-xl p-3.5 text-sm mb-2" style={{ background: 'var(--panel-2)', color: 'var(--ink)' }}>
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--pine)' }}>
                    To'g'ri variant
                  </div>
                  {feedback.corrected}
                </div>
              )}
              {feedback.tips?.length > 0 && (
                <ul className="text-sm muted list-disc pl-5 mb-2">
                  {feedback.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {!feedback.correct && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(null);
                      setAnswer('');
                    }}
                    className="btn btn-gold"
                  >
                    ✏️ Qayta urinish
                  </button>
                )}
                <button type="button" onClick={requestTask} className={`btn ${feedback.correct ? 'btn-primary' : 'btn-ghost'}`}>
                  🔁 Yangi vazifa
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <div className="alert alert-error mt-3 text-sm">{error}</div>}
      {!loading && !task && !error && (
        <button type="button" onClick={requestTask} className="btn btn-primary">
          Vazifa olish
        </button>
      )}
    </div>
  );
}
