import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { countCompletedMonths, sumAiStats } from '../lib/lessonProgress.js';

export default function Dashboard() {
  const { user, progress } = useAuth();
  const [langs, setLangs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.langs().then((r) => setLangs(r.langs)).catch((e) => setError(e.message));
  }, []);

  const completedTotal = countCompletedMonths(progress);
  const aiStats = sumAiStats(progress);
  const aiAccuracy = aiStats.attempts > 0 ? Math.round((aiStats.correct / aiStats.attempts) * 100) : null;

  return (
    <Layout>
      <div className="max-w-[1440px] mx-auto px-5 py-10">
        <div className="hero-card p-7 sm:p-10 mb-8">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-3 opacity-80">Yo'lovchi paneli</div>
          <h1 className="font-display text-3xl sm:text-5xl font-semibold leading-tight">
            Xush kelibsiz, {user?.displayName || user?.username} 👋
          </h1>
          <p className="mt-3 max-w-xl opacity-90">
            Davom ettirmoqchi bo'lgan yo'nalishni tanlang. Har bir bekat — yangi dars oyi: grammatika, lug'at, dialog va o'qish matni bilan.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/lang/en" className="px-5 py-3 rounded-xl font-semibold text-sm cursor-pointer" style={{ background: '#fff', color: '#0f5f4d' }}>
              🇬🇧 Ingliz tilini davom ettirish →
            </Link>
            <Link to="/library" className="px-5 py-3 rounded-xl font-semibold text-sm cursor-pointer border border-white/40 hover:bg-white/10">
              📚 Kutubxonam
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatChip label="Tugatilgan oylar" value={completedTotal} icon="✅" />
          <StatChip label="Yo'nalishlar" value="3" icon="🧭" />
          <StatChip label="Ingliz: so'z va ibora" value="2458+" icon="🗂️" />
          <StatChip label={aiAccuracy !== null ? `AI aniqligi (${aiStats.attempts})` : 'AI ustoz'} value={aiAccuracy !== null ? `${aiAccuracy}%` : '🤖'} icon="🎯" />
        </div>

        {error && (
          <div className="mb-6 text-sm px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {langs &&
            Object.values(langs).map((lang) => (
              <Link
                key={lang.key}
                to={`/lang/${lang.key}`}
                className="ticket-edge group block rounded-3xl border p-7 relative overflow-hidden transition-transform hover:-translate-y-1.5"
                style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
              >
                <div className="flex items-start justify-between mb-6">
                  <span className="text-4xl">{lang.flag}</span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-full"
                    style={{ background: 'var(--gold-soft)', color: 'var(--ink)' }}
                  >
                    {lang.eyebrow}
                  </span>
                </div>
                <div className="font-display text-2xl font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                  {lang.title}
                </div>
                <div className="font-mono text-xs tracking-wide mb-6" style={{ color: 'var(--ink-soft)' }}>
                  {lang.route}
                </div>
                <div className="dash-rail-h mb-3" />
                <div
                  className="font-mono text-xs uppercase tracking-widest flex items-center gap-1 font-semibold"
                  style={{ color: 'var(--pine)' }}
                >
                  Sayohatni boshlash
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}

          {!langs && !error && (
            <div className="font-mono text-sm" style={{ color: 'var(--ink-soft)' }}>
              Yuklanmoqda…
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatChip({ label, value, icon }) {
  return (
    <div className="stat-tile px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3">
      <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--gold-soft)' }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-semibold leading-none" style={{ color: 'var(--pine)' }}>{value}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest mt-1.5 leading-snug" style={{ color: 'var(--ink-soft)' }}>{label}</div>
      </div>
    </div>
  );
}
