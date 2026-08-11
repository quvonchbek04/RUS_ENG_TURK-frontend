import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { api } from '../lib/api.js';

export default function FullDictionaryPage() {
  const { lang } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [openCat, setOpenCat] = useState(null);

  useEffect(() => {
    setData(null);
    api.content(lang).then(setData).catch((e) => setError(e.message));
  }, [lang]);

  const totalWords = useMemo(() => {
    if (!data) return 0;
    return (data.dictExtra || []).reduce((s, c) => s + c.words.length, 0);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.dictExtra;
    return data.dictExtra
      .map((cat) => ({ ...cat, words: cat.words.filter((w) => w.some((cell) => String(cell).toLowerCase().includes(q))) }))
      .filter((cat) => cat.words.length > 0);
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to={`/lang/${lang}`} className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          ← {data.meta.title}
        </Link>

        <div className="mt-4 mb-6">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            To'liq lug'at
          </div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            {totalWords} ta qo'shimcha so'z · {data.dictExtra.length} kategoriya
          </h1>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="So'z yoki ma'nosini qidirish…"
          className="w-full mb-6 px-4 py-3 rounded-xl border outline-none focus:shadow-[0_0_0_3px_var(--gold-soft)]"
          style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
        />

        <div className="space-y-3">
          {filtered.map((cat, ci) => {
            const isOpen = query.trim() ? true : openCat === ci;
            return (
              <div key={ci} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
                <button
                  onClick={() => setOpenCat(isOpen && !query.trim() ? null : ci)}
                  className="w-full text-left p-4 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                      {cat.cat}
                    </div>
                    <div className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {cat.level} · {cat.words.length} ta so'z
                    </div>
                  </div>
                  <span className="font-mono text-xs shrink-0" style={{ color: 'var(--pine)' }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 grid sm:grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
                    {cat.words.map(([word, translit, meaning], i) => (
                      <div
                        key={i}
                        className="rounded-lg border p-2.5 flex items-center gap-2"
                        style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                            {word}
                          </div>
                          <div className="font-mono text-[11px]" style={{ color: 'var(--gold)' }}>
                            {translit}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                            {meaning}
                          </div>
                        </div>
                        <SpeakButton text={word} lang={lang} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="font-mono text-sm text-center py-16" style={{ color: 'var(--ink-soft)' }}>
              Hech narsa topilmadi.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
