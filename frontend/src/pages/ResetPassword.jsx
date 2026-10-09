import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import CodeField, { useCooldown } from '../components/CodeField.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

/** Parolni tiklash: 1) email kiritiladi → kod yuboriladi; 2) kod + yangi parol → parol almashadi. */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // email | code | done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useCooldown(0);
  const cleanEmail = email.trim().toLowerCase();

  async function sendCode(e) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.requestPasswordReset(cleanEmail);
      setCooldown(res?.cooldown || 60);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError('');
    try {
      const res = await api.requestPasswordReset(cleanEmail);
      setCooldown(res?.cooldown || 60);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  async function submitNew(e) {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError('Parollar bir xil emas');
      return;
    }
    setLoading(true);
    try {
      await api.resetPasswordWithCode({ email: cleanEmail, code, password });
      setStep('done');
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <AuthShell eyebrow="Tayyor" title="Parol yangilandi">
        <div className="alert alert-success mb-5">✅ Yangi parolingiz saqlandi. Kirish sahifasiga o'tilmoqda…</div>
        <Link to="/login" className="btn btn-primary btn-block">
          Kirish
        </Link>
      </AuthShell>
    );
  }

  if (step === 'code') {
    return (
      <AuthShell
        eyebrow="Xavfsizlik"
        title="Yangi parol o'rnating"
        footer={
          <button type="button" className="font-bold underline" style={{ color: 'var(--pine)' }} onClick={() => { setStep('email'); setError(''); }}>
            ← Emailni o'zgartirish
          </button>
        }
      >
        <form onSubmit={submitNew} className="space-y-4">
          <CodeField value={code} onChange={setCode} email={cleanEmail} cooldown={cooldown} onResend={resend} resending={resending} />
          <label className="field">
            <span className="label">Yangi parol (kamida 6 belgi)</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
          </label>
          <label className="field">
            <span className="label">Takrorlang</span>
            <input type="password" className="input" value={password2} onChange={(e) => setPassword2(e.target.value)} minLength={6} required autoComplete="new-password" />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-brand btn-lg btn-block" disabled={loading || code.length !== 6}>
            {loading ? <><span className="spinner" /> Saqlanmoqda…</> : 'Parolni saqlash'}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Parolni tiklash"
      title="Parolni unutdingizmi?"
      footer={
        <Link to="/login" className="font-bold" style={{ color: 'var(--pine)' }}>
          ← Kirish sahifasiga qaytish
        </Link>
      }
    >
      <form onSubmit={sendCode} className="space-y-4">
        <label className="field">
          <span className="label">Ro'yxatdan o'tgan email manzilingiz</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ism@gmail.com" autoComplete="email" />
        </label>
        <div className="alert alert-info text-sm">
          📱 Faqat telefon raqami bilan ro'yxatdan o'tgan bo'lsangiz, parolni administrator tiklab beradi.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading ? <><span className="spinner" /> Yuborilmoqda…</> : 'Emailga kod yuborish'}
        </button>
      </form>
    </AuthShell>
  );
}
