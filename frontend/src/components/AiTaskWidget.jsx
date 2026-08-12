import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

// type: 'text' | 'dialog'   content: matn yoki dialog qatorlaridan yig'ilgan matn   lang: 'ru' | 'en' | 'tr'
export default function AiTaskWidget({ type, content, lang }) {
  const { updateProgress } = useAuth();
  const [task, setTask] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  function recordStat(isCorrect) {
    updateProgress((prev) => {
      const aiStats = { ...(prev.aiStats || {}) };
      const langStats = { ...(aiStats[lang] || { attempts: 0, correct: 0 }) };
      langStats.attempts += 1;
      if (isCorrect) langStats.correct += 1;
      aiStats[lang] = langStats;
      return { ...prev, aiStats };
    });
  }

  async function requestTask() {
    setLoading(true);
    setError('');
    setFeedback(null);
    setAnswer('');
    setAttempts(0);
    try {
      const res = await api.aiTask({ type, content, lang });
      setTask(res);
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
      const res = await api.aiCheck({ context: content, question: task?.question, answer, lang });
      setFeedback(res);
      setAttempts((a) => a + 1);
      recordStat(Boolean(res.correct));
    } catch (e) {
      setError(e.message || 'Javobni tekshirishda xatolik yuz berdi');
    } finally {
      setChecking(false);
    }
  }

  function tryAgain() {
    // Xato bo'lganda, xuddi shu vazifaga qaytadan javob yozish imkoni.
    setFeedback(null);
    setAnswer('');
  }

  if (!task) {
    return (
      <div className="mt-4">
        <button
          onClick={requestTask}
          disabled={loading}
          className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold disabled:opacity-60"
          style={{ background: 'var(--gold)', color: 'var(--panel)' }}
        >
          {loading ? 'Vazifa tayyorlanmoqda…' : '🤖 AI bilan vazifa olish'}
        </button>
        {error && (
          <div className="mt-2 text-sm px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper-soft)' }}>
      <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
        🤖 AI vazifasi
      </div>
      <div className="mb-3" style={{ color: 'var(--ink)' }}>{task.question}</div>

      {!feedback && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Javobingizni shu yerga yozing…"
            rows={3}
            className="w-full rounded-lg border p-3 text-sm mb-2"
            style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={submitAnswer}
              disabled={checking || !answer.trim()}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold disabled:opacity-60"
              style={{ background: 'var(--pine)', color: 'var(--paper)' }}
            >
              {checking ? 'Tekshirilmoqda…' : 'Javobni tekshirish'}
            </button>
            <button
              onClick={requestTask}
              disabled={loading}
              className="font-mono text-xs uppercase tracking-widest px-3 py-2.5 rounded-xl cursor-pointer border"
              style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
            >
              🔁 Boshqa vazifa
            </button>
          </div>
        </>
      )}

      {feedback && (
        <div>
          <div
            className="rounded-lg p-3 text-sm mb-2 flex items-start gap-2"
            style={
              feedback.correct
                ? { background: 'var(--success-bg)', color: 'var(--ink)' }
                : { background: 'var(--error-bg)', color: 'var(--ink)' }
            }
          >
            <span className="shrink-0">{feedback.correct ? '✅' : '❌'}</span>
            <span>{feedback.feedback}</span>
          </div>

          {!feedback.correct && feedback.corrected && (
            <div
              className="rounded-lg p-3 text-sm mb-3"
              style={{ background: 'var(--paper-soft)', color: 'var(--ink)' }}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--pine)' }}>
                To'g'ri variant
              </div>
              {feedback.corrected}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {!feedback.correct && (
              <button
                onClick={tryAgain}
                className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold"
                style={{ background: 'var(--brick)', color: 'var(--paper)' }}
              >
                ✏️ Qayta urinish
              </button>
            )}
            <button
              onClick={requestTask}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold"
              style={
                feedback.correct
                  ? { background: 'var(--gold)', color: 'var(--panel)' }
                  : { background: 'var(--panel)', color: 'var(--ink-soft)', border: '1px solid var(--line)' }
              }
            >
              🔁 {feedback.correct ? 'Yana bir vazifa' : 'Boshqa vazifaga o\'tish'}
            </button>
          </div>

          {attempts > 1 && (
            <div className="mt-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
              Bu vazifada {attempts} marta urinildi
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
