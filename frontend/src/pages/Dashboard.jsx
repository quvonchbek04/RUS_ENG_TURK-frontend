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
        <div className="mb-10">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Yo'lovchi paneli
          </div>
          <h1 className="font-display text-4xl font-semibold" style={{ color: 'var(--ink)' }}>
            Xush kelibsiz, {user?.displayName || user?.username}
          </h1>
          <p className="mt-2" style={{ color: 'var(--ink-soft)' }}>
            Davom ettirmoqchi bo'lgan yo'nalishni tanlang. Har bir bekat — yangi dars oyi.
          </p>
        </div>

        <div className="flex items-center gap-4 mb-10 flex-wrap">
          <StatChip label="Tugatilgan oylar" value={completedTotal} />
          <StatChip label="Yo'nalishlar" value="3" />
          {aiAccuracy !== null && (
            <StatChip label={`🤖 AI ustoz aniqligi (${aiStats.attempts} urinish)`} value={`${aiAccuracy}%`} />
          )}
          <Link
            to="/library"
            className="rounded-xl border px-4 py-2.5 flex items-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--pine)' }}
          >
            📚 Kutubxonam
          </Link>
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
                className="ticket-edge group block rounded-2xl border p-6 relative overflow-hidden transition-transform hover:-translate-y-1"
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

function StatChip({ label, value }) {
  return (
    <div className="rounded-xl border px-4 py-2.5 flex items-center gap-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      <span className="font-display text-2xl font-semibold" style={{ color: 'var(--pine)' }}>
        {value}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </span>
    </div>
  );
}
