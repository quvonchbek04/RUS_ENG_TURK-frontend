import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import CodeField, { useCooldown } from '../components/CodeField.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

export default function Register() {
  const { register, user, booting } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // form | code
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useCooldown(0);

  if (!booting && user) return <Navigate to="/" replace />;

  const cleanEmail = email.trim().toLowerCase();
  const hasEmail = cleanEmail.length > 0;
  const hasPhone = phone.replace(/\D/g, '').length > 3;

  async function finish(withCode) {
    setLoading(true);
    setError('');
    try {
      await register({ email: cleanEmail, phone, password, displayName, code: withCode });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!hasEmail && !hasPhone) {
      setError('Email yoki telefon raqamidan kamida bittasini kiriting');
      return;
    }
    if (password !== password2) {
      setError('Parollar bir xil emas');
      return;
    }
    if (!hasEmail) {
      // Faqat telefon — tasdiqlash kodi kerak emas
      await finish('');
      return;
    }
    // Email bor — avval emailga kod yuboramiz
    setLoading(true);
    try {
      const res = await api.sendEmailCode(cleanEmail, 'register');
      setCooldown(res?.cooldown || 60);
      setCode('');
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
      const res = await api.sendEmailCode(cleanEmail, 'register');
      setCooldown(res?.cooldown || 60);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  if (step === 'code') {
    return (
      <AuthShell
        eyebrow="Emailni tasdiqlang"
        title="Kodni kiriting"
        footer={
          <button
            type="button"
            className="font-bold underline"
            style={{ color: 'var(--pine)' }}
            onClick={() => {
              setStep('form');
              setError('');
            }}
          >
            ← Ma'lumotlarni o'zgartirish
          </button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish(code);
          }}
          className="space-y-4"
        >
          <CodeField value={code} onChange={setCode} email={cleanEmail} cooldown={cooldown} onResend={resend} resending={resending} />
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" disabled={loading || code.length !== 6} className="btn btn-brand btn-lg btn-block">
            {loading ? <><span className="spinner" /> Tekshirilmoqda…</> : 'Tasdiqlash va hisob yaratish →'}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Yangi bilet · Ro'yxatdan o'tish"
      title="Hisob yarating"
      footer={
        <>
          Hisobingiz bormi?{' '}
          <Link to="/login" className="font-bold underline" style={{ color: 'var(--pine)' }}>
            Kirish
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="field">
          <span className="label">Ismingiz</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" placeholder="Masalan: Dilnoza" autoComplete="name" required />
        </label>

        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
          <label className="field">
            <span className="label flex items-center gap-2">
              📧 Email
              {hasEmail && <span className="badge badge-gold">kod yuboriladi</span>}
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              className="input"
              placeholder="ism@gmail.com"
            />
          </label>
          <label className="field">
            <span className="label flex items-center gap-2">
              📱 Telefon raqami
              {hasPhone && <span className="badge badge-pine">✓</span>}
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="input"
              placeholder="+998 90 123 45 67"
            />
          </label>
          <p className="text-xs muted leading-relaxed">
            Kamida bittasini kiriting. <b>Email</b> kiritsangiz, unga 6 xonali tasdiqlash kodi yuboriladi; <b>telefon</b> uchun kod kerak emas.
            Ikkalasini ham kiritsangiz, keyin qaysi biri qulay bo'lsa, shu bilan kirasiz.
          </p>
        </div>

        <label className="field">
          <span className="label">Parol (kamida 6 belgi)</span>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
        </label>
        <label className="field">
          <span className="label">Parolni takrorlang</span>
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6} autoComplete="new-password" className="input" placeholder="••••••" />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" disabled={loading} className="btn btn-brand btn-lg btn-block">
          {loading ? <><span className="spinner" /> {hasEmail ? 'Kod yuborilmoqda…' : 'Yaratilmoqda…'}</> : hasEmail ? 'Kodni yuborish →' : 'Biletni olish →'}
        </button>
      </form>
    </AuthShell>
  );
}
