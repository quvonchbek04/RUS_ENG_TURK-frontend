import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { PageHeader, PageLoading } from '../components/ui.jsx';
import { useContent } from '../lib/hooks.js';
import { readingHint } from '../lib/translit.js';

export default function VerbsPage() {
  const { lang } = useParams();
  const { data, error } = useContent(lang);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.verbTable;
    return data.verbTable.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
  }, [data, query]);

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

  const isEnglish = lang === 'en';

  return (
    <Layout>
      <div className="page">
        <PageHeader
          back={{ to: `/lang/${lang}`, label: data.meta.title }}
          eyebrow={`${data.meta.flag} Fe'llar`}
          title={`${isEnglish ? "Noto'g'ri fe'llar" : "Fe'llar jadvali"} · ${data.verbTable.length}`}
          subtitle={isEnglish ? "V1 · V2 (Past Simple) · V3 (Past Participle) shakllari" : "Eng ko'p ishlatiladigan fe'llar va ularning tarjimasi"}
        />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Qidirish…" className="input mb-5" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map((row, i) => (
            <div key={i} className="card-soft p-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-[17px]" style={{ color: 'var(--ink)' }}>
                  {row[0]}
                </div>
                {isEnglish ? (
                  <div className="font-mono text-xs mb-0.5" style={{ color: 'var(--gold)' }}>
                    {row[1]} · {row[2]}
                  </div>
                ) : (
                  <div className="font-mono text-xs mb-0.5" style={{ color: 'var(--gold)' }}>
                    {row[1] || readingHint(row[0], lang)}
                  </div>
                )}
                <div className="text-sm muted">{isEnglish ? row[3] : row[2]}</div>
              </div>
              <SpeakButton text={isEnglish ? `${row[0]}, ${row[1]}, ${row[2]}` : row[0]} lang={lang} />
            </div>
          ))}
        </div>
        {filtered.length === 0 && <div className="text-center muted py-12">Hech narsa topilmadi.</div>}
      </div>
    </Layout>
  );
}
