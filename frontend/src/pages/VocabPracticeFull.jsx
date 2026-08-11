import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ROUND_SIZE = 20;

export default function VocabPracticeFull() {
  const { lang } = useParams();
  const { updateProgress } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    api.content(lang).then(setData).catch((e) => setError(e.message));
  }, [lang]);

  // Kurs so'zlari (barcha oylardan) + to'liq qo'shimcha lug'at — bittalashtirib birlashtiriladi.
  // Bir xil so'z turli oylarda (masalan takrorlash uchun) qayta uchrashi mumkin —
  // shu sabab dublikat kaliti faqat so'zning o'zi bo'yicha olinadi.
  const pool = useMemo(() => {
    if (!data) return null;
    const seen = new Set();
    const combined = [];
    data.modules.forEach((mod) => {
      mod.months.forEach((month) => {
        (month.vocab || []).forEach(([word, translit, meaning]) => {
          const key = word.trim().toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          combined.push([word, translit, meaning]);
        });
      });
    });
    (data.dictExtra || []).forEach((cat) => {
      (cat.words || []).forEach(([word, translit, meaning]) => {
        const key = word.trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        combined.push([word, translit, meaning]);
      });
    });
    return combined;
  }, [data]);

  useEffect(() => {
    if (!pool) return;
    const roundWords = shuffle(pool).slice(0, Math.min(ROUND_SIZE, pool.length));
    const qs = roundWords.map(([word, translit, meaning]) => {
      const wrongPool = shuffle(pool.filter((v) => v[2] !== meaning)).slice(0, 3);
      const options = shuffle([meaning, ...wrongPool.map((w) => w[2])]);
      return { word, translit, meaning, options };
    });
    setQuestions(qs);
    setIndex(0);
    setCorrect(0);
    setSelected(null);
    setFinished(false);
  }, [pool, round]);

  function choose(option) {
    if (selected) return;
    setSelected(option);
    if (option === questions[index].meaning) setCorrect((c) => c + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  function finish() {
    setFinished(true);
    updateProgress((prev) => {
      const vocabStats = { ...(prev.vocabStats || {}) };
      const langStats = { ...(vocabStats[lang] || { attempts: 0, correct: 0 }) };
      langStats.attempts += questions.length;
      langStats.correct += correct;
      vocabStats[lang] = langStats;

      const testResultsFull = { ...(prev.testResultsFull || {}) };
      testResultsFull[lang] = { correct, total: questions.length, at: Date.now() };

      return { ...prev, vocabStats, testResultsFull };
    });
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-5 py-16 text-center" style={{ color: 'var(--brick)' }}>
          {error}
        </div>
      </Layout>
    );
  }

  if (!pool || !questions) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-5 py-16 font-mono text-sm" style={{ color: 'var(--ink-soft)' }}>
          Yuklanmoqda…
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link to={`/lang/${lang}`} className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          ← {data.meta.title}
        </Link>

        <div className="mt-4 mb-6">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Lug'at mashqi
          </div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
            {pool.length} ta so'z (kurs + to'liq lug'at)
          </h1>
        </div>

        <div className="mt-2">
          {!finished ? (
            <>
              <div className="flex items-center justify-between mb-4 font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
                <span>
                  Savol {index + 1}/{questions.length}
                </span>
                <span>To'g'ri: {correct}</span>
              </div>
              <div className="h-1.5 rounded-full mb-8 overflow-hidden" style={{ background: 'var(--paper-soft)' }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${((index + 1) / questions.length) * 100}%`, background: 'var(--gold)' }}
                />
              </div>

              <div className="ticket-edge rounded-2xl border p-8 text-center mb-6" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
                <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--ink-soft)' }}>
                  Bu so'z nimani anglatadi?
                </div>
                <div className="font-display text-3xl font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                  {questions[index].word}
                </div>
                <div className="font-mono text-sm mb-3" style={{ color: 'var(--gold)' }}>
                  {questions[index].translit}
                </div>
                <SpeakButton text={questions[index].word} lang={lang} size="lg" className="mx-auto" />
              </div>

              <div className="grid gap-3">
                {questions[index].options.map((opt, i) => {
                  const isSelected = selected === opt;
                  const isCorrectOpt = opt === questions[index].meaning;
                  let style = { borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' };
                  if (selected) {
                    if (isCorrectOpt) style = { borderColor: 'var(--pine)', background: 'var(--pine)', color: 'var(--paper)' };
                    else if (isSelected) style = { borderColor: 'var(--brick)', background: 'var(--error-bg)', color: 'var(--brick)' };
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => choose(opt)}
                      className="text-left px-5 py-3.5 rounded-xl border transition-colors cursor-pointer"
                      style={style}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {selected && (
                <button
                  onClick={next}
                  className="mt-6 w-full py-3 rounded-xl font-mono text-sm uppercase tracking-widest font-semibold cursor-pointer"
                  style={{ background: 'var(--pine)', color: 'var(--paper)' }}
                >
                  {index + 1 >= questions.length ? "Natijani ko'rish" : 'Keyingisi →'}
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <div className="text-6xl mb-4">{correct === questions.length ? '🏆' : '🎫'}</div>
              <h2 className="font-display text-3xl font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                {correct}/{questions.length} to'g'ri javob
              </h2>
              <p className="mb-8" style={{ color: 'var(--ink-soft)' }}>
                {pool.length > ROUND_SIZE
                  ? `${pool.length} ta so'zdan tasodifiy ${questions.length} tasi so'raldi. Yana bir turkum bilan davom eting.`
                  : 'Natijangiz saqlandi.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setRound((r) => r + 1)}
                  className="px-6 py-3 rounded-xl font-mono text-sm uppercase tracking-widest font-semibold cursor-pointer"
                  style={{ background: 'var(--gold)', color: 'var(--panel)' }}
                >
                  ↺ Yana bir turkum
                </button>
                <Link
                  to={`/lang/${lang}`}
                  className="inline-block px-6 py-3 rounded-xl font-mono text-sm uppercase tracking-widest font-semibold"
                  style={{ background: 'var(--pine)', color: 'var(--paper)' }}
                >
                  Yo'nalishga qaytish
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
