import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { api } from '../lib/api.js';

export default function VerbsPage() {
  const { lang } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setData(null);
    api.content(lang).then(setData).catch((e) => setError(e.message));
  }, [lang]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.verbTable;
    return data.verbTable.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
  }, [data, query]);

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

  const isEnglish = lang === 'en';

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to={`/lang/${lang}`} className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          ← {data.meta.title}
        </Link>

        <div className="mt-4 mb-6">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Fe'llar lug'ati
          </div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            {isEnglish ? "Noto'g'ri fe'llar" : "Fe'llar"} · {data.verbTable.length} ta
          </h1>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Qidirish…"
          className="w-full mb-6 px-4 py-3 rounded-xl border outline-none focus:shadow-[0_0_0_3px_var(--gold-soft)]"
          style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((row, i) => (
            <div
              key={i}
              className="rounded-xl border p-3.5 flex items-center gap-3"
              style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
            >
              <div className="flex-1 min-w-0">
                {isEnglish ? (
                  <>
                    <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                      {row[0]}
                    </div>
                    <div className="font-mono text-xs mb-1" style={{ color: 'var(--gold)' }}>
                      {row[1]} · {row[2]}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                      {row[3]}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                      {row[0]}
                    </div>
                    <div className="font-mono text-xs mb-1" style={{ color: 'var(--gold)' }}>
                      {row[1]}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                      {row[2]}
                    </div>
                  </>
                )}
              </div>
              <SpeakButton text={row[0]} lang={lang} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="font-mono text-sm col-span-2 text-center py-10" style={{ color: 'var(--ink-soft)' }}>
              Hech narsa topilmadi.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
