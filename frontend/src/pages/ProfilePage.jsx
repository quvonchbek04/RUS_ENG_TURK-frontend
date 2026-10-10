import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { LANG_OPTIONS, PageHeader, StatCard, formatDate } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import CodeField, { useCooldown } from '../components/CodeField.jsx';
import MyPermissions from '../components/MyPermissions.jsx';
import TelegramVerify from '../components/TelegramVerify.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../lib/hooks.js';
import { getRemember, setRemember } from '../lib/supabase.js';
import { getVoicesFor, speakSimple } from '../lib/tts.js';
import { countCompletedMonths, getStreak } from '../lib/lessonProgress.js';
import { formatPhone, normalizePhone } from '../lib/identity.js';
import { ROLE_LABEL } from '../lib/roles.js';
import { t } from '../i18n/index.js';
import { LanguageSwitcher } from '../i18n/react.jsx';

/** Kirish ma'lumotlari: email va telefon — ikkalasi bo'lsa, istalgani bilan kirish mumkin. */
function ContactCard({ user, setUser }) {
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone ? formatPhone(user.phone) : '+998 ');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useCooldown(0);
  // Super admin belgilagan qoidalar: email kodi kerakmi, telefon Telegram orqali tasdiqlanadimi
  const [rules, setRules] = useState({ emailCode: true, phoneTelegram: false });
  const [tg, setTg] = useState(null); // { token, link } — telefon almashtirish uchun Telegram so'rovi
  const [tgCode, setTgCode] = useState('');
  const cleanEmail = email.trim().toLowerCase();

  useEffect(() => {
    let off = false;
    api.signupConfig().then((c) => !off && setRules({ emailCode: c.emailCode, phoneTelegram: c.phoneTelegram }));
    return () => {
      off = true;
    };
  }, []);

  const phoneDigits = phone.replace(/\D/g, '').length > 3 ? normalizePhone(phone) : null;
  const phoneChanged = (phoneDigits ? '+' + phoneDigits : '') !== (user.phone || '');
  const phoneNeedsTg = rules.phoneTelegram && !!phoneDigits && phoneChanged;

  // Email kodsiz rejimda: to'g'ridan-to'g'ri saqlanadi
  async function saveEmailDirect() {
    setBusy('email-confirm');
    setMsg(null);
    try {
      const res = await api.updateContact({ email: cleanEmail });
      setUser(res.user);
      setMsg({ ok: true, text: t('✅ Email saqlandi — endi u bilan ham kira olasiz.') });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  // Yangi email — avval emailga 6 xonali kod yuboriladi, kod kiritilgach saqlanadi
  async function sendEmailCode() {
    setBusy('email');
    setMsg(null);
    try {
      const res = await api.sendEmailCode(cleanEmail, 'change-email');
      setCooldown(res?.cooldown || 60);
      setCode('');
      setCodeStep(true);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  async function confirmEmail(e) {
    e.preventDefault();
    setBusy('email-confirm');
    setMsg(null);
    try {
      const res = await api.updateContact({ email: cleanEmail, emailCode: code });
      setUser(res.user);
      setCodeStep(false);
      setCode('');
      setMsg({ ok: true, text: t('✅ Email tasdiqlandi va saqlandi — endi u bilan ham kira olasiz.') });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  async function startTelegram() {
    setBusy('tg');
    setMsg(null);
    try {
      const res = await api.tgStart({ phone, purpose: 'phone-change' });
      setTg({ token: res.token, link: res.link, direct: !!res.direct });
      setTgCode('');
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  async function savePhone() {
    setBusy('phone');
    setMsg(null);
    try {
      const res = await api.updateContact(phoneNeedsTg ? { phone, tgToken: tg?.token, tgCode } : { phone });
      setUser(res.user);
      setPhone(res.user.phone ? formatPhone(res.user.phone) : '+998 ');
      setTg(null);
      setTgCode('');
      setMsg({ ok: true, text: t('✅ Telefon saqlandi — endi u bilan ham kira olasiz.') });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="card p-5">
      <div className="h2 mb-1">{t("🔑 Kirish ma'lumotlari")}</div>
      <p className="text-sm muted mb-4">{t("Email ham, telefon ham kiritilgan bo'lsa — qaysi biri qulay bo'lsa, shu bilan kirasiz.")}</p>
      <div className="field">
        <label className="label" htmlFor="profile-email">
          {t('📧 Email')} {user.email && <span className="badge badge-pine ml-1">{rules.emailCode ? t('tasdiqlangan') : t('ulangan')}</span>}
        </label>
        <div className="flex gap-2">
          <input
            id="profile-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setCodeStep(false);
            }}
            placeholder="ism@gmail.com"
            autoComplete="email"
          />
          <button
            type="button"
            className="btn btn-soft shrink-0"
            disabled={busy === 'email' || busy === 'email-confirm' || !cleanEmail || cleanEmail === (user.email || '')}
            onClick={rules.emailCode ? sendEmailCode : saveEmailDirect}
          >
            {busy === 'email' || busy === 'email-confirm' ? <span className="spinner" /> : rules.emailCode ? t('Kod yuborish') : t('Saqlash')}
          </button>
        </div>
        {codeStep && (
          <form onSubmit={confirmEmail} className="mt-3 card-soft p-3.5">
            <CodeField value={code} onChange={setCode} email={cleanEmail} cooldown={cooldown} onResend={sendEmailCode} resending={busy === 'email'} />
            <button type="submit" className="btn btn-primary mt-3" disabled={busy === 'email-confirm' || code.length !== 6}>
              {busy === 'email-confirm' ? <span className="spinner" /> : t('✓ Tasdiqlash va saqlash')}
            </button>
          </form>
        )}
      </div>
      <div className="field">
        <label className="label" htmlFor="profile-phone">
          {t('📱 Telefon')} {user.phone && <span className="badge badge-pine ml-1">{t('ulangan')}</span>}
        </label>
        <div className="flex gap-2">
          <input
            id="profile-phone"
            type="tel"
            inputMode="tel"
            className="input"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setTg(null);
            }}
            placeholder="+998 90 123 45 67"
            autoComplete="tel"
          />
          {phoneNeedsTg && !tg ? (
            <button type="button" className="btn btn-soft shrink-0" disabled={busy === 'tg'} onClick={startTelegram}>
              {busy === 'tg' ? <span className="spinner" /> : t('✈️ Telegram orqali')}
            </button>
          ) : (
            <button type="button" className="btn btn-soft shrink-0" disabled={busy === 'phone' || (phoneNeedsTg && tgCode.length !== 6)} onClick={savePhone}>
              {busy === 'phone' ? <span className="spinner" /> : t('Saqlash')}
            </button>
          )}
        </div>
        {phoneNeedsTg && tg && (
          <div className="mt-3">
            <TelegramVerify link={tg.link} direct={tg.direct} phone={phone} code={tgCode} onCode={setTgCode} onRestart={startTelegram} restarting={busy === 'tg'} />
          </div>
        )}
      </div>
      <div className="field">
        <span className="label">{t('Login')}</span>
        <div className="card-soft px-3.5 py-2.5 text-sm font-mono" style={{ color: 'var(--ink)' }}>
          {user.username}
        </div>
      </div>
      {msg && <div className={`alert mt-3 ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
    </div>
  );
}
const SAMPLE = { en: 'Hello! How are you today?', ru: 'Привет! Как у тебя дела?', tr: 'Merhaba! Bugün nasılsın?' };

export default function ProfilePage() {
  const { user, setUser, progress, updateProgress, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const isStaff = user?.role === 'admin' || user?.role === 'superadmin';
  const [theme, toggleTheme] = useTheme();
  const [name, setName] = useState(user?.displayName || '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [remember, setRem] = useState(getRemember());
  const [, force] = useState(0);

  async function saveName(e) {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await api.updateProfile({ displayName: name });
      setUser(res.user);
      setMsg({ ok: true, text: t('Saqlandi ✅') });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw !== pw2) return setPwMsg({ ok: false, text: t('Parollar bir xil emas') });
    try {
      await api.updatePassword(pw);
      setPw('');
      setPw2('');
      setPwMsg({ ok: true, text: t("Parol o'zgartirildi ✅") });
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    }
  }

  // Admin ochganda ruxsatlari serverdan yangilanadi (super admin o'zgartirgan bo'lishi mumkin); #perms havolasi shu bo'limga olib boradi
  useEffect(() => {
    if (isStaff) refreshUser().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);
  useEffect(() => {
    if (hash === '#perms' && isStaff) document.getElementById('perms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, isStaff]);

  function setVoice(lang, patch) {
    updateProgress((prev) => {
      const voiceSettings = { ...(prev.voiceSettings || {}) };
      voiceSettings[lang] = { rate: 0.9, voiceURI: null, ...(voiceSettings[lang] || {}), ...patch };
      return { ...prev, voiceSettings };
    });
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow={t('Profil')}
          title={user.displayName || user.username}
          subtitle={t("{role} · ro'yxatdan o'tgan: {date}", { role: ROLE_LABEL[user.role] || user.role, date: formatDate(user.createdAt) })}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon="⭐" label={t('Jami XP')} value={progress.xpTotal || 0} tone="gold" />
          <StatCard icon="🔥" label={t('Kunlik seriya')} value={getStreak(progress)} tone="brick" />
          <StatCard icon="✅" label={t('Tugatilgan darslar')} value={countCompletedMonths(progress)} />
          <StatCard icon="🧾" label={t('Mashqlar')} value={(progress.practiceHistory || []).length} tone="sky" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {isStaff && <MyPermissions user={user} onRefresh={refreshUser} />}

          <div className="card p-5">
            <div className="h2 mb-4">{t("👤 Shaxsiy ma'lumotlar")}</div>
            <form onSubmit={saveName}>
              <label className="field">
                <span className="label">{t('Ism')}</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              {msg && <div className={`alert mt-3 ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
              <button type="submit" className="btn btn-primary mt-4">
                {t('Saqlash')}
              </button>
            </form>
          </div>

          <ContactCard user={user} setUser={setUser} />

          <div className="card p-5">
            <div className="h2 mb-4">{t("🔒 Parolni o'zgartirish")}</div>
            <form onSubmit={savePassword}>
              <label className="field">
                <span className="label">{t('Yangi parol')}</span>
                <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required autoComplete="new-password" />
              </label>
              <label className="field">
                <span className="label">{t('Takrorlang')}</span>
                <input type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} required autoComplete="new-password" />
              </label>
              {pwMsg && <div className={`alert mt-3 ${pwMsg.ok ? 'alert-success' : 'alert-error'}`}>{pwMsg.text}</div>}
              <button type="submit" className="btn btn-primary mt-4">
                {t('Parolni yangilash')}
              </button>
            </form>
          </div>

          <div className="card p-5">
            <div className="h2 mb-4">{t('🔊 Talaffuz ovozi')}</div>
            <p className="text-sm muted mb-3">{t("Har bir til uchun ovoz va tezlikni tanlang (telefoningizdagi o'rnatilgan ovozlar ko'rsatiladi).")}</p>
            <div className="space-y-4">
              {LANG_OPTIONS.map((l) => {
                const v = progress.voiceSettings?.[l.key] || { rate: 0.9, voiceURI: null };
                const voices = getVoicesFor(l.key);
                return (
                  <div key={l.key} className="card-soft p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-sm flex-1" style={{ color: 'var(--ink)' }}>
                        {l.flag} {l.label}
                      </span>
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => speakSimple(SAMPLE[l.key], l.key, v)}>
                        {t('▶ Sinash')}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select className="select !w-auto flex-1 min-w-[160px] !py-2 text-sm" value={v.voiceURI || ''} onFocus={() => force((x) => x + 1)} onChange={(e) => setVoice(l.key, { voiceURI: e.target.value || null })}>
                        <option value="">{t('Standart ovoz')}</option>
                        {voices.map((vo) => (
                          <option key={vo.voiceURI} value={vo.voiceURI}>
                            {vo.name}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs muted">
                        {t('Tezlik')}
                        <input type="range" min="0.5" max="1.4" step="0.1" value={v.rate ?? 0.9} onChange={(e) => setVoice(l.key, { rate: parseFloat(e.target.value) })} style={{ accentColor: 'var(--pine)' }} />
                        <span className="font-mono">{(v.rate ?? 0.9).toFixed(1)}x</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="h2 mb-4">{t('⚙️ Sozlamalar')}</div>
            <div className="space-y-3">
              <div className="card-soft p-3.5">
                <div className="font-bold text-sm mb-2" style={{ color: 'var(--ink)' }}>
                  {t('🌐 Sayt tili')}
                </div>
                <LanguageSwitcher />
                <p className="text-xs muted mt-2 leading-relaxed">{t("Menyular, tugmalar va AI ustoz javoblari tanlangan tilda chiqadi. Dars materiallaridagi tushuntirishlar o'zbek tilida qoladi.")}</p>
              </div>
              <button type="button" className="card-soft p-3.5 w-full flex items-center gap-3 text-left" onClick={toggleTheme}>
                <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span className="flex-1 font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  {theme === 'dark' ? t('Mavzu: Tungi') : t('Mavzu: Kunduzgi')}
                </span>
                <span className="text-xs muted">{t('almashtirish')}</span>
              </button>
              <label className="card-soft p-3.5 flex items-center gap-3 cursor-pointer">
                <span className="text-xl">💾</span>
                <span className="flex-1 font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  {t('Brauzer yopilganda ham tizimda qolish')}
                </span>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => {
                    setRem(e.target.checked);
                    setRemember(e.target.checked);
                  }}
                  style={{ accentColor: 'var(--pine)' }}
                />
              </label>
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                {t('⎋ Tizimdan chiqish')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
