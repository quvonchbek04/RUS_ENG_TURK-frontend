import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getRemember } from '../lib/supabase.js';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

export default function Login() {
  const { login, user, booting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(getRemember());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!booting && user) return <Navigate to={location.state?.from || '/'} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password, remember);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Xush kelibsiz"
      title="Hisobingizga kiring"
      footer={
        <>
          Hisobingiz yo'qmi?{' '}
          <Link to="/register" className="font-bold underline" style={{ color: 'var(--pine)' }}>
            Ro'yxatdan o'tish
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="field">
          <span className="label">Email, telefon raqami yoki login</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
            autoCapitalize="off"
            className="input"
            placeholder="ism@gmail.com yoki +998 90 123 45 67"
          />
        </label>
        <label className="field">
          <span className="label">Parol</span>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
            Meni eslab qol
          </label>
          <Link to="/reset-password" className="font-bold" style={{ color: 'var(--pine)' }}>
            Parolni unutdingizmi?
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" disabled={loading} className="btn btn-brand btn-lg btn-block">
          {loading ? <><span className="spinner" /> Kirilmoqda…</> : 'Kirish →'}
        </button>
      </form>
    </AuthShell>
  );
}
