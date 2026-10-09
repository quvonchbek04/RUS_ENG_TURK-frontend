import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import AiTaskWidget from '../components/AiTaskWidget.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { GrammarMore } from '../components/LessonExtras.jsx';
import { PageHeader, PageLoading } from '../components/ui.jsx';
import { useContent } from '../lib/hooks.js';
import { useTutor } from '../context/TutorContext.jsx';

export default function GrammarPage() {
  const { lang } = useParams();
  const { data, error } = useContent(lang);
  const { ask } = useTutor();
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');

  const topics = useMemo(() => {
    if (!data) return [];
    const list = [];
    data.modules.forEach((mod) => mod.months.forEach((month) => month.grammar && list.push({ mod, month, grammar: month.grammar })));
    return list;
  }, [data]);

  if (error) {
    return (
      <Layout>
        <div className="page-narrow">
          <div className="alert alert-error">{error}</div>
        </div>
      </Layout>
    );
  }
  if (!data) return <Layout><PageLoading /></Layout>;

  const q = query.trim().toLowerCase();
  const filtered = topics.filter(({ month, grammar }) => !q || `${grammar.title} ${grammar.text} ${month.topic}`.toLowerCase().includes(q));

  return (
    <Layout>
      <div className="page-narrow">
        <PageHeader
          back={{ to: `/lang/${lang}`, label: data.meta.title }}
          eyebrow={`${data.meta.flag} Grammatika`}
          title={`Barcha mavzular · ${topics.length}`}
          subtitle="Darslardagi barcha grammatik qoidalar bir joyda. Tushunmagan joyingizni AI ustozdan so'rang."
        />
        <input className="input mb-4" placeholder="🔍 Mavzu qidirish…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="space-y-3">
          {filtered.map(({ mod, month, grammar }) => {
            const isOpen = openId === month.id || !!q;
            return (
              <div key={month.id} className="card overflow-hidden">
                <button type="button" className="w-full text-left p-4 flex items-center gap-3" onClick={() => setOpenId(isOpen && !q ? null : month.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>
                      {month.label} · {month.topic}
                    </div>
                    <div className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                      {grammar.title}
                    </div>
                  </div>
                  <span className="muted text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                    <p className="leading-relaxed mb-4 text-[15px]" style={{ color: 'var(--ink)' }}>
                      {grammar.text}
                    </p>
                    <div className="space-y-2">
                      {(grammar.examples || []).map((ex, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5" style={{ background: 'var(--pine-soft)' }}>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold" style={{ color: 'var(--ink)' }}>
                              {ex[0]}
                            </div>
                            <div className="text-sm muted">{ex[1]}</div>
                          </div>
                          <SpeakButton text={ex[0]} lang={lang} />
                        </div>
                      ))}
                    </div>
                    <GrammarMore items={grammar.more} />
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => ask(`"${grammar.title}" mavzusini sodda misollar bilan tushuntirib ber`)}>
                        🤖 Ustozdan tushuntirish
                      </button>
                      <Link to={`/lang/${lang}/month/${mod.id}/${month.id}`} className="btn btn-ghost btn-sm">
                        📘 Darsga o'tish
                      </Link>
                    </div>
                    <AiTaskWidget
                      type="text"
                      content={`${grammar.title}\n${grammar.text}\n${(grammar.examples || []).map((ex) => ex.join(' — ')).join('\n')}`}
                      lang={lang}
                      title="Grammatika bo'yicha AI vazifa"
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
