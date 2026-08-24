import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import LessonsModal from '../components/LessonsModal.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { flattenMonths, isMonthDone } from '../lib/lessonProgress.js';

export default function RoutePage() {
  const { lang } = useParams();
  const { progress } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [lessonsInitialModule, setLessonsInitialModule] = useState(null);

  useEffect(() => {
    setData(null);
    api.content(lang).then(setData).catch((e) => setError(e.message));
  }, [lang]);

  if (error) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <p style={{ color: 'var(--brick)' }}>{error}</p>
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

  const flat = flattenMonths(data.modules);
  const doneCount = flat.filter((m) => isMonthDone(progress, lang, m.id)).length;
  const nextMonth = flat.find((m) => !isMonthDone(progress, lang, m.id)) || flat[flat.length - 1];

  return (
    <Layout>
      <div className="max-w-[1440px] mx-auto px-5 py-10">
        <Link to="/" className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
          ← Panelga qaytish
        </Link>

        <div className="mt-4 mb-4 flex items-center gap-4">
          <span className="text-5xl">{data.meta.flag}</span>
          <div>
            <h1 className="font-display text-4xl font-semibold" style={{ color: 'var(--ink)' }}>
              {data.meta.title}
            </h1>
            <div className="font-mono text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--gold)' }}>
              {data.meta.route}
            </div>
          </div>
        </div>

        <div className="font-mono text-xs uppercase tracking-widest mb-8" style={{ color: 'var(--ink-soft)' }}>
          {doneCount}/{flat.length} dars yakunlandi · har bir dars oldingisi tugagach ochiladi
        </div>

        {/* Davom ettirish — tezkor amallar qatori */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          <button
            type="button"
            onClick={() => {
              setLessonsInitialModule(null);
              setLessonsOpen(true);
            }}
            className="rounded-xl border p-3 flex items-center gap-3 text-left transition-colors cursor-pointer"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: 'var(--paper-soft)' }}>📘</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Barcha darslar</div>
              <div className="font-mono text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>4 bosqich · {flat.length} dars</div>
            </div>
          </button>
          <Link
            to={`/lang/${lang}/month/${nextMonth.moduleId}/${nextMonth.id}`}
            className="rounded-xl border p-3 flex items-center gap-3 transition-colors"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: 'var(--paper-soft)' }}>🎯</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Davom ettirish</div>
              <div className="font-mono text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>{nextMonth.label} · {nextMonth.topic}</div>
            </div>
          </Link>
          <Link
            to={`/lang/${lang}/practice-full`}
            className="rounded-xl border p-3 flex items-center gap-3 transition-colors"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: 'var(--paper-soft)' }}>🔀</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Lug'at mashqi</div>
              <div className="font-mono text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>Kurs + to'liq lug'at</div>
            </div>
          </Link>
          <Link
            to={`/lang/${lang}/dictionary`}
            className="rounded-xl border p-3 flex items-center gap-3 transition-colors"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: 'var(--paper-soft)' }}>📖</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>To'liq lug'at</div>
              <div className="font-mono text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>Qo'shimcha so'zlar ro'yxati</div>
            </div>
          </Link>
        </div>

        {/* Bosqichlar — ixcham progress ko'rinishi (to'liq ro'yxat "Barcha darslar" oynasida) */}
        <div className="grid sm:grid-cols-2 gap-4">
          {data.modules.map((mod, idx) => {
            const monthsDoneInMod = mod.months.filter((m) => isMonthDone(progress, lang, m.id)).length;
            const pct = Math.round((monthsDoneInMod / mod.months.length) * 100);
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  setLessonsInitialModule(mod.id);
                  setLessonsOpen(true);
                }}
                className="rounded-xl border p-4 text-left cursor-pointer transition-transform hover:-translate-y-0.5"
                style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-semibold shrink-0"
                    style={{ background: 'var(--paper-soft)', color: 'var(--ink)' }}
                  >
                    {idx + 1}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    {monthsDoneInMod}/{mod.months.length} dars
                  </span>
                </div>
                <div className="font-display font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                  {mod.title}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--paper-soft)' }}>
                  <div className="h-full" style={{ width: `${pct}%`, background: 'var(--pine)' }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <LessonsModal
        open={lessonsOpen}
        onClose={() => {
          setLessonsOpen(false);
          setLessonsInitialModule(null);
        }}
        modules={data.modules}
        lang={lang}
        flat={flat}
        progress={progress}
        initialModuleId={lessonsInitialModule}
      />
    </Layout>
  );
}
