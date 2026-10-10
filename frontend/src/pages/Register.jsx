import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { t } from '../i18n/index.js';
import { Rich } from '../i18n/react.jsx';
import CodeField, { useCooldown } from '../components/CodeField.jsx';
import TelegramVerify from '../components/TelegramVerify.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

/** Ismdan login taklif qiladi: kichik lotin harflari, raqamlar va _ . - */
function suggestLogin(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 30);
}

const TG_BLUE = '#229ED9';
const POLL_MS = 2000;

export default function Register() {
  const { register, user, booting } = useAuth();
  const navigate = useNavigate();
  // Super admin yoqqan usullar (login / email / telefon / Telegram bot), email kodi va Telegram tasdiqlash
  const [cfg, setCfg] = useState({ methods: { login: true, email: true, phone: true, telegram: false }, emailCode: true, phoneTelegram: false, tgBot: '', mailReady: true });
  const [mode, setMode] = useState(null); // 'simple' (ism + login + parol) | 'contact' (email / telefon)
  const [step, setStep] = useState('form'); // form | verify | tgreg
  const [displayName, setDisplayName] = useState('');
  const [login, setLogin] = useState('');
  const [loginTouched, setLoginTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [tg, setTg] = useState(null); // { token, link, direct } — telefonni Telegram kodi bilan tasdiqlash
  const [tgCode, setTgCode] = useState('');
  const [tgReg, setTgReg] = useState(null); // { token, link, status: 'waiting' | 'verified' | 'expired', phone } — Telegram bot orqali ro'yxatdan o'tish
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [restartingTg, setRestartingTg] = useState(false);
  const [cooldown, setCooldown] = useCooldown(0);

  useEffect(() => {
    let off = false;
    api.signupConfig().then((c) => !off && setCfg(c));
    return () => {
      off = true;
    };
  }, []);

  // Qadam almashganda (forma → tasdiqlash / Telegram) sahifa tepasiga qaytamiz — yangi qadam ko'rinib tursin
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Telegram bot orqali ro'yxatdan o'tish: bot kontaktni qabul qilguncha sayt holatni har 2 soniyada so'raydi
  const tgRegToken = tgReg?.token;
  const tgRegStatus = tgReg?.status;
  useEffect(() => {
    if (step !== 'tgreg' || !tgRegToken || tgRegStatus !== 'waiting') return undefined;
    let off = false;
    let timer;
    const tick = async () => {
      try {
        const r = await api.tgStatus(tgRegToken);
        if (off) return;
        if (r?.status === 'verified') {
          setTgReg((s) => (s ? { ...s, status: 'verified', phone: r.phone || '' } : s));
          return;
        }
        if (r?.status === 'expired') {
          setTgReg((s) => (s ? { ...s, status: 'expired' } : s));
          return;
        }
      } catch {
        /* tarmoq xatosi — keyingi urinishda qayta so'raymiz */
      }
      if (!off) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    // Foydalanuvchi Telegramdan saytga qaytganda darhol tekshiramiz (fon oynada taymerlar sekinlashadi)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [step, tgRegToken, tgRegStatus]);

  if (!booting && user) return <Navigate to="/" replace />;

  const { methods } = cfg;
  const simpleAllowed = methods.login;
  const contactAllowed = methods.email || methods.phone;
  // Tanlangan rejim ruxsat etilmagan bo'lsa — mavjudiga o'tamiz
  const activeMode = mode === 'simple' && simpleAllowed ? 'simple' : mode === 'contact' && contactAllowed ? 'contact' : contactAllowed ? 'contact' : simpleAllowed ? 'simple' : 'none';
  // Faqat Telegram bot orqali ro'yxatdan o'tish yoqilgan bo'lishi mumkin — u holda forma o'rniga faqat bot tugmasi chiqadi
  const closed = activeMode === 'none' && !methods.telegram;

  const cleanEmail = email.trim().toLowerCase();
  const hasEmail = activeMode === 'contact' && methods.email && cleanEmail.length > 0;
  const hasPhone = activeMode === 'contact' && methods.phone && phone.replace(/\D/g, '').length > 3;
  const needsEmailCode = hasEmail && cfg.emailCode;
  const needsTg = hasPhone && cfg.phoneTelegram;
  const finalLogin = loginTouched ? login : suggestLogin(displayName);

  async function finish() {
    setLoading(true);
    setError('');
    try {
      await register({
        email: hasEmail ? cleanEmail : '',
        phone: hasPhone ? phone : '',
        username: activeMode === 'simple' ? finalLogin : '',
        password,
        displayName,
        code,
        tgToken: needsTg ? tg?.token : undefined,
        tgCode: needsTg ? tgCode : undefined,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startTelegram() {
    const res = await api.tgStart({ phone });
    setTg({ token: res.token, link: res.link, direct: !!res.direct });
    setTgCode('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (activeMode === 'none') {
      setError(t("Hozircha ro'yxatdan o'tish yopiq. Administrator bilan bog'laning."));
      return;
    }
    if (activeMode === 'contact' && !hasEmail && !hasPhone) {
      setError(methods.email && methods.phone ? t('Email yoki telefon raqamidan kamida bittasini kiriting') : methods.email ? t('Email manzilini kiriting') : t('Telefon raqamini kiriting'));
      return;
    }
    if (password !== password2) {
      setError(t('Parollar bir xil emas'));
      return;
    }
    if (!needsEmailCode && !needsTg) {
      await finish();
      return;
    }
    // Tasdiqlash kerak: emailga kod yuboramiz va/yoki Telegram so'rovini boshlaymiz
    setLoading(true);
    try {
      if (needsEmailCode) {
        const res = await api.sendEmailCode(cleanEmail, 'register');
        setCooldown(res?.cooldown || 60);
        setCode('');
      }
      if (needsTg) await startTelegram();
      setStep('verify');
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

  async function restartTelegram() {
    setRestartingTg(true);
    setError('');
    try {
      await startTelegram();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestartingTg(false);
    }
  }

  // ---------- Telegram bot orqali ro'yxatdan o'tish ----------
  async function startTgRegister() {
    setError('');
    setLoading(true);
    // Oyna bosish bilan bir vaqtda ochiladi (so'rovdan keyin ochilsa brauzer bloklashi mumkin), keyin bot havolasiga yo'naltiriladi
    const popup = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    try {
      const res = await api.tgRegisterStart();
      setTgReg({ token: res.token, link: res.link, status: 'waiting', phone: '' });
      setStep('tgreg');
      if (popup) popup.location.href = res.link;
    } catch (err) {
      if (popup) popup.close();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function finishTgRegister(e) {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError(t('Parollar bir xil emas'));
      return;
    }
    setLoading(true);
    try {
      await register({ tgToken: tgReg.token, displayName, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      // Tasdiqlash so'rovi eskirgan bo'lsa — qaytadan boshlash kerak
      api
        .tgStatus(tgReg.token)
        .then((r) => r?.status === 'expired' && setTgReg((s) => (s ? { ...s, status: 'expired' } : s)))
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  function leaveTgRegister() {
    setStep('form');
    setTgReg(null);
    setError('');
  }

  if (step === 'tgreg' && tgReg) {
    const verified = tgReg.status === 'verified';
    const expired = tgReg.status === 'expired';
    return (
      <AuthShell
        eyebrow={t('Telegram orqali · bepul')}
        title={verified ? t('Deyarli tayyor') : t("Telegram bot orqali ro'yxatdan o'tish")}
        footer={
          <button type="button" className="font-bold underline" style={{ color: 'var(--pine)' }} onClick={leaveTgRegister}>
            {t("← Boshqa usulni tanlash")}
          </button>
        }
      >
        {verified ? (
          <form onSubmit={finishTgRegister} className="space-y-4">
            <div className="alert alert-success text-sm">{t('✅ Telegramda raqamingiz tasdiqlandi: {phone}', { phone: tgReg.phone || '' })}</div>
            <label className="field">
              <span className="label">{t('Ismingiz')}</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" placeholder={t('Masalan: Dilnoza')} autoComplete="name" required autoFocus />
            </label>
            <label className="field">
              <span className="label">{t('Parol (kamida 6 belgi)')}</span>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
            </label>
            <label className="field">
              <span className="label">{t('Parolni takrorlang')}</span>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6} autoComplete="new-password" className="input" placeholder="••••••" />
            </label>
            <p className="text-xs muted leading-relaxed">{t('Keyin telefon raqamingiz va shu parol bilan kirasiz.')}</p>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-brand btn-lg btn-block">
              {loading ? <><span className="spinner" /> {t('Yaratilmoqda…')}</> : t('Hisob yaratish →')}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <ol className="list-decimal pl-5 space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
              <li>{t('«Telegramni ochish» tugmasini bosing — bot ochiladi (ochilmagan bo\'lsa, pastdagi tugmadan foydalaning).')}</li>
              <li>{t('Botda «Start» (Boshlash) tugmasini bosing.')}</li>
              <li>{t('«📱 Raqamni ulashish» tugmasini bosing (faqat o\'zingizning raqamingiz qabul qilinadi).')}</li>
              <li>{t('Shu sahifaga qayting — ro\'yxatdan o\'tish avtomatik davom etadi. Kod yozish shart emas.')}</li>
            </ol>
            <a href={tgReg.link} target="_blank" rel="noreferrer" className="btn btn-lg btn-block" style={{ background: TG_BLUE, color: '#fff' }}>
              {t('✈️ Telegramni ochish')}
            </a>
            {expired ? (
              <div className="alert alert-warn text-sm">
                {t("So'rov muddati tugadi.")}{' '}
                <button type="button" className="font-bold underline" onClick={startTgRegister} disabled={loading}>
                  {loading ? t('Yuborilmoqda…') : t('↻ Qaytadan boshlash')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-sm muted">
                <span className="spinner" /> {t('Botda raqamingiz tasdiqlanishi kutilmoqda…')}
              </div>
            )}
            {error && <div className="alert alert-error">{error}</div>}
          </div>
        )}
      </AuthShell>
    );
  }

  if (step === 'verify') {
    const ready = (!needsEmailCode || code.length === 6) && (!needsTg || (tg && tgCode.length === 6));
    return (
      <AuthShell
        eyebrow={t('Tasdiqlash')}
        title={t('Kodni kiriting')}
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
            {t("← Ma'lumotlarni o'zgartirish")}
          </button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
          className="space-y-4"
        >
          {needsEmailCode && <CodeField value={code} onChange={setCode} email={cleanEmail} cooldown={cooldown} onResend={resend} resending={resending} />}
          {needsTg && tg && (
            <TelegramVerify link={tg.link} direct={tg.direct} phone={phone} code={tgCode} onCode={setTgCode} onRestart={restartTelegram} restarting={restartingTg} autoFocus={!needsEmailCode} />
          )}
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" disabled={loading || !ready} className="btn btn-brand btn-lg btn-block">
            {loading ? <><span className="spinner" /> {t('Tekshirilmoqda…')}</> : t('Tasdiqlash va hisob yaratish →')}
          </button>
        </form>
      </AuthShell>
    );
  }

  const submitLabel = needsEmailCode || needsTg ? t('Kodni yuborish →') : t('Biletni olish →');
  const showTgBlock = methods.telegram || !!cfg.tgBot;

  return (
    <AuthShell
      eyebrow={t("Yangi bilet · Ro'yxatdan o'tish")}
      title={t('Hisob yarating')}
      footer={
        <>
          {t('Hisobingiz bormi?')}{' '}
          <Link to="/login" className="font-bold underline" style={{ color: 'var(--pine)' }}>
            {t('Kirish')}
          </Link>
        </>
      }
    >
      {closed ? (
        <div className="alert alert-warn">{t("Hozircha ro'yxatdan o'tish yopiq. Administrator bilan bog'laning.")}</div>
      ) : (
        activeMode !== 'none' && (
          <form onSubmit={onSubmit} className="space-y-4">
            {simpleAllowed && contactAllowed && (
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label={t("Ro'yxatdan o'tish usuli")}>
                {[
                  ['simple', t('👤 Ism va parol')],
                  ['contact', methods.email && methods.phone ? t('📧 Email / 📱 Telefon') : methods.email ? t('📧 Email') : t('📱 Telefon')],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={activeMode === k}
                    onClick={() => {
                      setMode(k);
                      setError('');
                    }}
                    className={`chip justify-center ${activeMode === k ? 'chip-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <label className="field">
              <span className="label">{t('Ismingiz')}</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" placeholder={t('Masalan: Dilnoza')} autoComplete="name" required />
            </label>

            {activeMode === 'simple' && (
              <label className="field">
                <span className="label">{t('Login (kirish uchun)')}</span>
                <input
                  value={finalLogin}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    setLoginTouched(true);
                  }}
                  className="input"
                  placeholder="dilnoza_01"
                  autoComplete="username"
                  autoCapitalize="off"
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-zA-Z0-9_.\-]{3,40}"
                  title={t('Lotin harflari, raqamlar va _ . - belgilari (3–40 ta)')}
                />
                <span className="help">{t('Lotin harflari, raqamlar va _ . - belgilari. Keyin shu login va parol bilan kirasiz.')}</span>
              </label>
            )}

            {activeMode === 'contact' && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
                {methods.email && (
                  <label className="field">
                    <span className="label flex items-center gap-2">
                      {t('📧 Email')}
                      {needsEmailCode && <span className="badge badge-gold">{t('kod yuboriladi')}</span>}
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
                )}
                {methods.phone && (
                  <label className="field">
                    <span className="label flex items-center gap-2">
                      {t('📱 Telefon raqami')}
                      {hasPhone && <span className="badge badge-pine">{needsTg ? t('Telegram kodi') : '✓'}</span>}
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
                )}
                <p className="text-xs muted leading-relaxed">
                  {methods.email && methods.phone
                    ? t('Kamida bittasini kiriting. Ikkalasini ham kiritsangiz, keyin qaysi biri qulay bo\'lsa, shu bilan kirasiz.')
                    : t('Shu orqali keyin tizimga kirasiz.')}{' '}
                  {methods.email && (cfg.emailCode ? t('Emailga 6 xonali tasdiqlash kodi yuboriladi.') : t('Email uchun tasdiqlash kodi kerak emas.'))}{' '}
                  {methods.phone && (cfg.phoneTelegram ? t('Telefon raqami Telegram bot orqali tasdiqlanadi.') : t('Telefon uchun kod kerak emas.'))}
                </p>
                {methods.phone && cfg.phoneTelegram && (
                  <p className="text-xs muted leading-relaxed">
                    {t("Raqamingiz botda avval tasdiqlangan bo'lsa, kod Telegramga darhol keladi; aks holda bir marta botni ochasiz.")}
                    {cfg.tgBot && (
                      <>
                        {' '}
                        <a href={`https://t.me/${cfg.tgBot}`} target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: 'var(--pine)' }}>
                          {t('✈️ Telegram botni ochish')}
                        </a>
                      </>
                    )}
                  </p>
                )}
                {needsEmailCode && !cfg.mailReady && <div className="alert alert-warn text-xs">{t("Email orqali tasdiqlash hozircha ishlamayapti — boshqa usuldan foydalaning yoki administratorga murojaat qiling.")}</div>}
              </div>
            )}

            <label className="field">
              <span className="label">{t('Parol (kamida 6 belgi)')}</span>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
            </label>
            <label className="field">
              <span className="label">{t('Parolni takrorlang')}</span>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6} autoComplete="new-password" className="input" placeholder="••••••" />
            </label>

            {activeMode === 'simple' && (
              <p className="text-xs muted leading-relaxed">
                <Rich text={t("**Oddiy usul:** email yoki telefon kerak emas. Parolni unutsangiz, uni faqat administrator tiklab bera oladi — shuning uchun eslab qoling.")} />
              </p>
            )}

            {error && <div className="alert alert-error">{error}</div>}

            <button type="submit" disabled={loading} className="btn btn-brand btn-lg btn-block">
              {loading ? <><span className="spinner" /> {needsEmailCode || needsTg ? t('Kod yuborilmoqda…') : t('Yaratilmoqda…')}</> : submitLabel}
            </button>
          </form>
        )
      )}

      {/* Sahifa pastida: Telegram botga o'tish joylari */}
      {showTgBlock && (
        <div className={activeMode !== 'none' ? 'mt-6 pt-5 border-t space-y-3' : 'space-y-3'} style={activeMode !== 'none' ? { borderColor: 'var(--line)' } : undefined}>
          {activeMode !== 'none' && <div className="text-center text-[11px] font-bold uppercase tracking-[0.16em] faint">{t('yoki Telegram orqali')}</div>}
          {methods.telegram && (
            <>
              <button type="button" onClick={startTgRegister} disabled={loading} className="btn btn-lg btn-block" style={{ background: TG_BLUE, color: '#fff' }}>
                {loading && activeMode === 'none' ? <><span className="spinner" /> {t('Yuborilmoqda…')}</> : t("✈️ Telegram bot orqali ro'yxatdan o'tish (bepul)")}
              </button>
              <p className="text-xs muted text-center leading-relaxed">{t("Kod yozish shart emas: botda «Start» va «Raqamni ulashish» tugmalarini bosasiz, xolos.")}</p>
              {activeMode === 'none' && error && <div className="alert alert-error">{error}</div>}
            </>
          )}
          {cfg.tgBot && (
            <a href={`https://t.me/${cfg.tgBot}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-block">
              {t('🤖 Telegram botga o\'tish · @{bot}', { bot: cfg.tgBot })}
            </a>
          )}
        </div>
      )}
    </AuthShell>
  );
}
