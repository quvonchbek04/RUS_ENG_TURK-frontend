import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2" style={{ background: 'var(--paper)' }}>
      <div
        className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--pine)', color: 'var(--paper)' }}
      >
        <div className="font-mono text-xs tracking-[0.3em] uppercase opacity-80">Chegara nazorati · Kirish</div>
        <div>
          <div className="font-display text-5xl font-semibold leading-[1.05] mb-4">
            Til sayohati<br />davom etadi.
          </div>
          <p className="max-w-sm opacity-85 leading-relaxed">
            Toshkentdan — Moskva, London va Istanbulga. Har bir bekat yangi so'zlar,
            grammatika va dialoglar bilan kutmoqda.
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs opacity-80">
          <span>TSH</span>
          <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.35)' }} />
          <span>MOW · LON · IST</span>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
              Bilet raqami · Kirish
            </div>
            <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
              Hisobingizga kiring
            </h1>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Login
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--gold-soft)]"
                style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
                placeholder="masalan: anvar"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Parol
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--gold-soft)]"
                style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-mono text-sm uppercase tracking-widest font-semibold transition-transform active:scale-[0.98] cursor-pointer disabled:opacity-60"
              style={{ background: 'var(--pine)', color: 'var(--paper)' }}
            >
              {loading ? 'Tekshirilmoqda…' : 'Kirish →'}
            </button>
          </form>

          <p className="mt-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Hisobingiz yo'qmi?{' '}
            <Link to="/register" className="font-semibold underline" style={{ color: 'var(--pine)' }}>
              Ro'yxatdan o'ting
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
