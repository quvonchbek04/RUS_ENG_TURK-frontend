import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import AiTaskWidget from '../components/AiTaskWidget.jsx';
import { api } from '../lib/api.js';

export default function DialogsPage() {
  const { lang } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState(null);

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

  const monthDialogs = [];
  data.modules.forEach((mod) => {
    mod.months.forEach((month) => {
      if (month.dialog) {
        monthDialogs.push({
          key: `m-${month.id}`,
          title: month.dialog.title,
          sub: `${month.label} · ${month.topic}`,
          lines: month.dialog.lines,
        });
      }
    });
  });

  const extraDialogs = (data.dialogsExtra || []).map((d, i) => ({
    key: `x-${i}`,
    title: d.title,
    sub: `${d.subtitle} · ${d.level}`,
    lines: d.lines,
  }));

  const all = [...monthDialogs, ...extraDialogs];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to={`/lang/${lang}`} className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          ← {data.meta.title}
        </Link>

        <div className="mt-4 mb-8">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Dialog mashqi
          </div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            Barcha dialoglar · {all.length} ta
          </h1>
        </div>

        <div className="space-y-3">
          {all.map((d) => {
            const isOpen = openKey === d.key;
            return (
              <div key={d.key} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
                <button
                  onClick={() => setOpenKey(isOpen ? null : d.key)}
                  className="w-full text-left p-4 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                      {d.title}
                    </div>
                    <div className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {d.sub}
                    </div>
                  </div>
                  <span className="font-mono text-xs shrink-0" style={{ color: 'var(--pine)' }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                    {d.lines.map(([speaker, line, tr], i) => (
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
                    <AiTaskWidget
                      type="dialog"
                      content={d.lines.map(([speaker, line, tr]) => `${speaker}: ${line} (${tr})`).join('\n')}
                      lang={lang}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
