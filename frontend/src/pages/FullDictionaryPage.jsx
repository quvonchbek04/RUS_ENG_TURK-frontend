import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { PageHeader, PageLoading } from '../components/ui.jsx';
import { useContent } from '../lib/hooks.js';
import { useTutor } from '../context/TutorContext.jsx';
import { readingHint } from '../lib/translit.js';

const TABS = [
  { key: 'words', icon: '🗂️', label: "So'zlar" },
  { key: 'phrases', icon: '💬', label: 'Iboralar' },
  { key: 'course', icon: '📘', label: 'Kurs lug\'ati' },
  { key: 'extra', icon: '📖', label: "Qo'shimcha" },
];

export default function FullDictionaryPage() {
  const { lang } = useParams();
  const { data, error } = useContent(lang);
  const { ask } = useTutor();
  const [tab, setTab] = useState('words');
  const [cat, setCat] = useState(-1);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(60);
  const [hide, setHide] = useState(false);

  // Har bir tab uchun yagona shakl: { cats: [nomlar], rows: [[so'z, ma'no, gap, gap tarjimasi, cat, talaffuz]] }
  const sections = useMemo(() => {
    if (!data) return null;
    const course = [];
    const courseCats = [];
    data.modules.forEach((mod) =>
      mod.months.forEach((m) => {
        const ci = courseCats.length;
        courseCats.push(`${m.label} · ${m.topic}`);
        (m.vocab || []).forEach(([w, t, mm]) => course.push([w, mm, '', '', ci, t !== w ? t : '']));
      })
    );
    return {
      words: { cats: (data.wordbank || []).map((c) => c.title), rows: (data.wordbank || []).flatMap((c, ci) => c.rows.map((r) => [r[0], r[1], r[2], r[3], ci, ''])) },
      phrases: { cats: (data.phrasebank || []).map((c) => c.title), rows: (data.phrasebank || []).flatMap((c, ci) => c.rows.map((r) => [r[0], r[1], r[2], r[3], ci, ''])) },
      course: { cats: courseCats, rows: course },
      extra: { cats: (data.dictExtra || []).map((c) => c.cat), rows: (data.dictExtra || []).flatMap((c, ci) => c.words.map(([w, t, mm]) => [w, mm, '', '', ci, t !== w ? t : ''])) },
    };
  }, [data]);

  const current = sections?.[tab];
  const filtered = useMemo(() => {
    if (!current) return [];
    const q = query.trim().toLowerCase();
    return current.rows.filter((r) => (cat < 0 || r[4] === cat) && (!q || String(r[0]).toLowerCase().includes(q) || String(r[1]).toLowerCase().includes(q)));
  }, [current, cat, query]);

  if (error) {
    return (
      <Layout>
        <div className="page-narrow">
          <div className="alert alert-error">{error}</div>
        </div>
      </Layout>
    );
  }
  if (!sections) return <Layout><PageLoading /></Layout>;

  return (
    <Layout>
      <div className="page">
        <PageHeader
          back={{ to: `/lang/${lang}`, label: data.meta.title }}
          eyebrow={`${data.meta.flag} Lug'at`}
          title={`${sections.words.rows.length} so'z · ${sections.phrases.rows.length} ibora`}
          subtitle="Har bir so'z misol gap va tarjimasi bilan. Talaffuzni tinglang, AI ustozdan tushuntirish so'rang."
          actions={
            <Link to={`/lang/${lang}/practice-full?source=${tab === 'words' ? 'wordcat' : tab === 'phrases' ? 'phrases' : tab === 'course' ? 'course' : 'dict'}`} className="btn btn-primary">
              🔀 Mashq qilish
            </Link>
          }
        />

        <div className="tabs mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`chip ${tab === t.key ? 'chip-active' : ''}`}
              onClick={() => {
                setTab(t.key);
                setCat(-1);
                setLimit(60);
              }}
            >
              {t.icon} {t.label} · {sections[t.key].rows.length}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-[1fr_auto] gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(60);
            }}
            placeholder="🔍 So'z yoki tarjimasini qidiring…"
            className="input"
          />
          <select
            className="select sm:!w-72"
            value={cat}
            onChange={(e) => {
              setCat(Number(e.target.value));
              setLimit(60);
            }}
          >
            <option value={-1}>Barcha mavzular</option>
            {current.cats.map((c, i) => (
              <option key={i} value={i}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="muted">{filtered.length} ta natija</span>
          <label className="flex items-center gap-2 cursor-pointer select-none muted">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
            Tarjimani yashirish
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-2.5">
          {filtered.slice(0, limit).map(([w, m, s, st, ci, t], i) => {
            const hint = readingHint(w, lang) || t;
            return (
              <div key={`${w}-${i}`} className="card-soft p-3.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display font-semibold text-[17px]" style={{ color: 'var(--ink)' }}>
                      {w}
                    </span>
                    {hint && hint !== w && <span className="font-mono text-xs faint">{hint}</span>}
                  </div>
                  <div
                    className="text-sm font-semibold cursor-pointer"
                    style={{ color: 'var(--gold)', filter: hide ? 'blur(6px)' : 'none' }}
                    onClick={(e) => (e.currentTarget.style.filter = 'none')}
                  >
                    {m}
                  </div>
                  {s && (
                    <div className="text-[13px] italic mt-1" style={{ color: 'var(--ink)' }}>
                      {s}
                    </div>
                  )}
                  {st && <div className="text-xs muted" style={{ filter: hide ? 'blur(5px)' : 'none' }}>{st}</div>}
                  {cat < 0 && <div className="text-[10.5px] faint mt-1 truncate">{current.cats[ci]}</div>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <SpeakButton text={w} lang={lang} />
                  {s && <SpeakButton text={s} lang={lang} title="Gapni eshitish" />}
                  <button type="button" className="w-8 h-8 rounded-full text-sm" style={{ background: 'var(--sky-soft)' }} title="AI ustozdan tushuntirish" onClick={() => ask(`"${w}" so'zini tushuntirib ber va misollar keltir`)}>
                    🤖
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <div className="text-center muted py-14">Hech narsa topilmadi.</div>}
        {filtered.length > limit && (
          <button type="button" className="btn btn-ghost btn-block mt-4" onClick={() => setLimit((l) => l + 90)}>
            Yana ko'rsatish ({filtered.length - limit} ta qoldi)
          </button>
        )}
      </div>
    </Layout>
  );
}
