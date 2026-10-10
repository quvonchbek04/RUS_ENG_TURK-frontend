import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { t } from '../i18n/index.js';
import CodeField, { useCooldown } from '../components/CodeField.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

/** Parolni tiklash: 1) email (yoki Telegramga bog'langan telefon) kiritiladi → kod yuboriladi; 2) kod + yangi parol → parol almashadi. */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [method, setMethod] = useState('email'); // email | telegram
  const [step, setStep] = useState('email'); // email | code | done
  const [tgBot, setTgBot] = useState(''); // bot ulangan bo'lsa — Telegram orqali tiklash taklif qilinadi
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [tgToken, setTgToken] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useCooldown(0);
  const cleanEmail = email.trim().toLowerCase();
  const viaTg = method === 'telegram';

  useEffect(() => {
    let off = false;
    api.signupConfig().then((c) => !off && setTgBot(c.tgBot || ''));
    return () => {
      off = true;
    };
  }, []);

  async function sendCode(e) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (viaTg) {
        const res = await api.tgResetStart(phone);
        setTgToken(res.token);
        setCooldown(60);
      } else {
        const res = await api.requestPasswordReset(cleanEmail);
        setCooldown(res?.cooldown || 60);
      }
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
      if (viaTg) {
        const res = await api.tgResetStart(phone);
        setTgToken(res.token);
        setCooldown(60);
      } else {
        const res = await api.requestPasswordReset(cleanEmail);
        setCooldown(res?.cooldown || 60);
      }
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
      setError(t('Parollar bir xil emas'));
      return;
    }
    setLoading(true);
    try {
      if (viaTg) await api.resetPasswordWithTelegram({ phone, token: tgToken, code, password });
      else await api.resetPasswordWithCode({ email: cleanEmail, code, password });
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
      <AuthShell eyebrow={t('Tayyor')} title={t('Parol yangilandi')}>
        <div className="alert alert-success mb-5">{t("✅ Yangi parolingiz saqlandi. Kirish sahifasiga o'tilmoqda…")}</div>
        <Link to="/login" className="btn btn-primary btn-block">
          {t('Kirish')}
        </Link>
      </AuthShell>
    );
  }

  if (step === 'code') {
    return (
      <AuthShell
        eyebrow={t('Xavfsizlik')}
        title={t("Yangi parol o'rnating")}
        footer={
          <button type="button" className="font-bold underline" style={{ color: 'var(--pine)' }} onClick={() => { setStep('email'); setError(''); }}>
            {viaTg ? t("← Raqamni o'zgartirish") : t("← Emailni o'zgartirish")}
          </button>
        }
      >
        <form onSubmit={submitNew} className="space-y-4">
          {viaTg ? (
            <>
              <div className="alert alert-info text-sm">{t('✈️ Kod Telegramdagi bot chatiga yuborildi (10 daqiqa amal qiladi).')}</div>
              <CodeField channel="telegram" value={code} onChange={setCode} />
              <button type="button" className="text-sm font-bold disabled:opacity-60" style={{ color: 'var(--pine)' }} onClick={resend} disabled={cooldown > 0 || resending}>
                {resending ? t('Yuborilmoqda…') : cooldown > 0 ? t('Kodni qayta yuborish ({n} s)', { n: cooldown }) : t('↻ Kodni qayta yuborish')}
              </button>
            </>
          ) : (
            <CodeField value={code} onChange={setCode} email={cleanEmail} cooldown={cooldown} onResend={resend} resending={resending} />
          )}
          <label className="field">
            <span className="label">{t('Yangi parol (kamida 6 belgi)')}</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
          </label>
          <label className="field">
            <span className="label">{t('Takrorlang')}</span>
            <input type="password" className="input" value={password2} onChange={(e) => setPassword2(e.target.value)} minLength={6} required autoComplete="new-password" />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-brand btn-lg btn-block" disabled={loading || code.length !== 6}>
            {loading ? <><span className="spinner" /> {t('Saqlanmoqda…')}</> : t('Parolni saqlash')}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={t('Parolni tiklash')}
      title={t('Parolni unutdingizmi?')}
      footer={
        <Link to="/login" className="font-bold" style={{ color: 'var(--pine)' }}>
          {t('← Kirish sahifasiga qaytish')}
        </Link>
      }
    >
      <form onSubmit={sendCode} className="space-y-4">
        {tgBot && (
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label={t('Tiklash usuli')}>
            {[
              ['email', t('📧 Email')],
              ['telegram', t('✈️ Telegram')],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={method === k}
                onClick={() => {
                  setMethod(k);
                  setError('');
                }}
                className={`chip justify-center ${method === k ? 'chip-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {viaTg ? (
          <>
            <label className="field">
              <span className="label">{t("Ro'yxatdan o'tgan telefon raqamingiz")}</span>
              <input type="tel" inputMode="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+998 90 123 45 67" autoComplete="tel" />
            </label>
            <div className="alert alert-info text-sm">
              {t("Kod shu raqam Telegram botda tasdiqlangan chatga yuboriladi. Raqamingiz botda hech qachon tasdiqlanmagan bo'lsa, bu usul ishlamaydi — administratorga murojaat qiling.")}
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span className="label">{t("Ro'yxatdan o'tgan email manzilingiz")}</span>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ism@gmail.com" autoComplete="email" />
            </label>
            <div className="alert alert-info text-sm">{t("📱 Faqat telefon raqami yoki login bilan ro'yxatdan o'tgan bo'lsangiz, parolni administrator tiklab beradi.")}</div>
          </>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading ? <><span className="spinner" /> {t('Yuborilmoqda…')}</> : viaTg ? t('Telegramga kod yuborish') : t('Emailga kod yuborish')}
        </button>
      </form>
    </AuthShell>
  );
}
