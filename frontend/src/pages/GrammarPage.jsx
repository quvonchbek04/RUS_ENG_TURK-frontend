import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import AiTaskWidget from '../components/AiTaskWidget.jsx';
import { api } from '../lib/api.js';

export default function GrammarPage() {
  const { lang } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api.content(lang).then(setData).catch((e) => setError(e.message));
  }, [lang]);

  if (error) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-5 py-16 text-center" style={{ color: 'var(--brick)' }}>
          {error}
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-5 py-16 font-mono text-sm" style={{ color: 'var(--ink-soft)' }}>
          Yuklanmoqda…
        </div>
      </Layout>
    );
  }

  const topics = [];
  data.modules.forEach((mod) => {
    mod.months.forEach((month) => {
      if (month.grammar) {
        topics.push({ month, grammar: month.grammar });
      }
    });
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to={`/lang/${lang}`} className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          ← {data.meta.title}
        </Link>

        <div className="mt-4 mb-8">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Grammatika ko'rib chiqish
          </div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            Barcha mavzular · {topics.length} ta
          </h1>
        </div>

        <div className="space-y-4">
          {topics.map(({ month, grammar }) => (
            <div key={month.id} className="rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
              <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
                {month.label} · {month.topic}
              </div>
              <h3 className="font-display text-xl font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                {grammar.title}
              </h3>
              <p className="leading-relaxed mb-4" style={{ color: 'var(--ink)' }}>
                {grammar.text}
              </p>
              {grammar.examples?.length > 0 && (
                <div className="space-y-1.5">
                  {grammar.examples.map((ex, i) => (
                    <div key={i} className="font-mono text-sm flex gap-2">
                      <span style={{ color: 'var(--pine)' }}>{ex[0]}</span>
                      <span style={{ color: 'var(--ink-soft)' }}>— {ex[1]}</span>
                    </div>
                  ))}
                </div>
              )}
              <AiTaskWidget
                type="text"
                content={`${grammar.title}\n${grammar.text}\n${(grammar.examples || []).map((ex) => ex.join(' — ')).join('\n')}`}
                lang={lang}
              />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
