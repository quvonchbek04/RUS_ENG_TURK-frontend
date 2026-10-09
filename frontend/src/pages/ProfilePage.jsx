import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { LANG_OPTIONS, PageHeader, StatCard, formatDate } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import CodeField, { useCooldown } from '../components/CodeField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../lib/hooks.js';
import { getRemember, setRemember } from '../lib/supabase.js';
import { getVoicesFor, speakSimple } from '../lib/tts.js';
import { countCompletedMonths, getStreak } from '../lib/lessonProgress.js';
import { formatPhone } from '../lib/identity.js';

const ROLE_LABEL = { superadmin: 'Super admin', admin: 'Admin', user: "O'quvchi" };

/** Kirish ma'lumotlari: email va telefon — ikkalasi bo'lsa, istalgani bilan kirish mumkin. */
function ContactCard({ user, setUser }) {
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone ? formatPhone(user.phone) : '+998 ');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useCooldown(0);
  const cleanEmail = email.trim().toLowerCase();

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
      setMsg({ ok: true, text: '✅ Email tasdiqlandi va saqlandi — endi u bilan ham kira olasiz.' });
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
      const res = await api.updateContact({ phone });
      setUser(res.user);
      setPhone(res.user.phone ? formatPhone(res.user.phone) : '+998 ');
      setMsg({ ok: true, text: '✅ Telefon saqlandi — endi u bilan ham kira olasiz.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="card p-5">
      <div className="h2 mb-1">🔑 Kirish ma'lumotlari</div>
      <p className="text-sm muted mb-4">Email ham, telefon ham kiritilgan bo'lsa — qaysi biri qulay bo'lsa, shu bilan kirasiz.</p>
      <div className="field">
        <label className="label" htmlFor="profile-email">
          📧 Email {user.email && <span className="badge badge-pine ml-1">tasdiqlangan</span>}
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
            disabled={busy === 'email' || !cleanEmail || cleanEmail === (user.email || '')}
            onClick={sendEmailCode}
          >
            {busy === 'email' ? <span className="spinner" /> : 'Kod yuborish'}
          </button>
        </div>
        {codeStep && (
          <form onSubmit={confirmEmail} className="mt-3 card-soft p-3.5">
            <CodeField value={code} onChange={setCode} email={cleanEmail} cooldown={cooldown} onResend={sendEmailCode} resending={busy === 'email'} />
            <button type="submit" className="btn btn-primary mt-3" disabled={busy === 'email-confirm' || code.length !== 6}>
              {busy === 'email-confirm' ? <span className="spinner" /> : '✓ Tasdiqlash va saqlash'}
            </button>
          </form>
        )}
      </div>
      <label className="field">
        <span className="label">📱 Telefon {user.phone && <span className="badge badge-pine ml-1">ulangan</span>}</span>
        <div className="flex gap-2">
          <input type="tel" inputMode="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" autoComplete="tel" />
          <button type="button" className="btn btn-soft shrink-0" disabled={busy === 'phone'} onClick={savePhone}>
            {busy === 'phone' ? <span className="spinner" /> : 'Saqlash'}
          </button>
        </div>
      </label>
      <div className="field">
        <span className="label">Login</span>
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
  const { user, setUser, progress, updateProgress, logout } = useAuth();
  const navigate = useNavigate();
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
      setMsg({ ok: true, text: 'Saqlandi ✅' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw !== pw2) return setPwMsg({ ok: false, text: 'Parollar bir xil emas' });
    try {
      await api.updatePassword(pw);
      setPw('');
      setPw2('');
      setPwMsg({ ok: true, text: "Parol o'zgartirildi ✅" });
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    }
  }

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
        <PageHeader eyebrow="Profil" title={user.displayName || user.username} subtitle={`${ROLE_LABEL[user.role] || user.role} · ro'yxatdan o'tgan: ${formatDate(user.createdAt)}`} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon="⭐" label="Jami XP" value={progress.xpTotal || 0} tone="gold" />
          <StatCard icon="🔥" label="Kunlik seriya" value={getStreak(progress)} tone="brick" />
          <StatCard icon="✅" label="Tugatilgan darslar" value={countCompletedMonths(progress)} />
          <StatCard icon="🧾" label="Mashqlar" value={(progress.practiceHistory || []).length} tone="sky" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="h2 mb-4">👤 Shaxsiy ma'lumotlar</div>
            <form onSubmit={saveName}>
              <label className="field">
                <span className="label">Ism</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              {msg && <div className={`alert mt-3 ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
              <button type="submit" className="btn btn-primary mt-4">
                Saqlash
              </button>
            </form>
          </div>

          <ContactCard user={user} setUser={setUser} />

          <div className="card p-5">
            <div className="h2 mb-4">🔒 Parolni o'zgartirish</div>
            <form onSubmit={savePassword}>
              <label className="field">
                <span className="label">Yangi parol</span>
                <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required autoComplete="new-password" />
              </label>
              <label className="field">
                <span className="label">Takrorlang</span>
                <input type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} required autoComplete="new-password" />
              </label>
              {pwMsg && <div className={`alert mt-3 ${pwMsg.ok ? 'alert-success' : 'alert-error'}`}>{pwMsg.text}</div>}
              <button type="submit" className="btn btn-primary mt-4">
                Parolni yangilash
              </button>
            </form>
          </div>

          <div className="card p-5">
            <div className="h2 mb-4">🔊 Talaffuz ovozi</div>
            <p className="text-sm muted mb-3">Har bir til uchun ovoz va tezlikni tanlang (telefoningizdagi o'rnatilgan ovozlar ko'rsatiladi).</p>
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
                        ▶ Sinash
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select className="select !w-auto flex-1 min-w-[160px] !py-2 text-sm" value={v.voiceURI || ''} onFocus={() => force((x) => x + 1)} onChange={(e) => setVoice(l.key, { voiceURI: e.target.value || null })}>
                        <option value="">Standart ovoz</option>
                        {voices.map((vo) => (
                          <option key={vo.voiceURI} value={vo.voiceURI}>
                            {vo.name}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs muted">
                        Tezlik
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
            <div className="h2 mb-4">⚙️ Sozlamalar</div>
            <div className="space-y-3">
              <button type="button" className="card-soft p-3.5 w-full flex items-center gap-3 text-left" onClick={toggleTheme}>
                <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span className="flex-1 font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  Mavzu: {theme === 'dark' ? 'Tungi' : 'Kunduzgi'}
                </span>
                <span className="text-xs muted">almashtirish</span>
              </button>
              <label className="card-soft p-3.5 flex items-center gap-3 cursor-pointer">
                <span className="text-xl">💾</span>
                <span className="flex-1 font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  Brauzer yopilganda ham tizimda qolish
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
                ⎋ Tizimdan chiqish
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
