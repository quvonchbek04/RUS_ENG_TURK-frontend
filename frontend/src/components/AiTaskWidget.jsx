import { useState } from 'react';
import { api } from '../lib/api.js';

// type: 'text' | 'dialog'   content: matn yoki dialog qatorlaridan yig'ilgan matn   lang: 'ru' | 'en' | 'tr'
export default function AiTaskWidget({ type, content, lang }) {
  const [task, setTask] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function requestTask() {
    setLoading(true);
    setError('');
    setFeedback(null);
    setAnswer('');
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
    } catch (e) {
      setError(e.message || 'Javobni tekshirishda xatolik yuz berdi');
    } finally {
      setChecking(false);
    }
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
            className="rounded-lg p-3 text-sm mb-3"
            style={{ background: 'var(--success-bg)', color: 'var(--ink)' }}
          >
            {feedback.feedback}
          </div>
          <button
            onClick={requestTask}
            className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold"
            style={{ background: 'var(--gold)', color: 'var(--panel)' }}
          >
            🔁 Yana bir vazifa
          </button>
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
