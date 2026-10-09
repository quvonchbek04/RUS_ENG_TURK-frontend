import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { Modal, PageHeader, StatCard, formatDate, formatDateTime } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { MEDIA_META, MEDIA_ORDER } from '../lib/media.js';
import { formatPhone } from '../lib/identity.js';
import UsersPanel, { ROLE_LABEL } from './admin/UsersPanel.jsx';
import MailPanel from './admin/MailPanel.jsx';


const PROVIDERS = {
  gemini: { label: 'Google Gemini', link: 'https://aistudio.google.com/apikey', model: 'gemini-flash-latest', note: 'Bepul kalit beriladi. Tavsiya etiladi.' },
  openai: { label: 'OpenAI (ChatGPT)', link: 'https://platform.openai.com/api-keys', model: 'gpt-4o-mini', note: "Pullik, hisobda balans bo'lishi kerak." },
  groq: { label: 'Groq (Llama)', link: 'https://console.groq.com/keys', model: 'llama-3.3-70b-versatile', note: 'Bepul limit bilan, juda tez.' },
  openrouter: { label: 'OpenRouter', link: 'https://openrouter.ai/keys', model: 'openrouter/auto', note: "Ko'plab modellarga bitta kalit." },
  deepseek: { label: 'DeepSeek', link: 'https://platform.deepseek.com/api_keys', model: 'deepseek-chat', note: 'Arzon narxlar.' },
  custom: { label: 'Boshqa (OpenAI-mos API)', link: '', model: '', note: 'Base URL va model nomini kiriting.' },
};
const PROVIDER_MODES = [
  ['auto', '🔄 Avtomatik — qaysi kalit faol bo\'lsa'],
  ['gemini', 'Faqat Gemini'],
  ['openai', 'Faqat OpenAI'],
  ['groq', 'Faqat Groq'],
  ['openrouter', 'Faqat OpenRouter'],
  ['deepseek', 'Faqat DeepSeek'],
  ['custom', 'Faqat boshqa (custom)'],
  ['mock', "⛔ AI o'chiq (oddiy rejim)"],
];

const TABS = [
  ['home', '🏠 Umumiy'],
  ['users', '👥 Foydalanuvchilar'],
  ['ai', '🤖 AI va API kalitlar'],
  ['mail', '✉️ Email xizmati'],
  ['content', '🗂️ Materiallar'],
  ['stats', '📊 Statistika'],
];

// =====================================================================
// STATISTIKA
// =====================================================================
function StatsTab() {
  const [stats, setStats] = useState(null);
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.adminStats().then(setStats).catch((e) => setError(e.message));
    api.getContentStats().then(setContent).catch(() => {});
  }, []);
  return (
    <div>
      {error && <div className="alert alert-warn mb-4">Statistika olinmadi: {error}</div>}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Foydalanuvchilar bo'yicha raqamlar — faqat super adminga keladi (oddiy adminda null) */}
          {stats.users != null && (
            <>
              <StatCard icon="👥" label="Foydalanuvchilar" value={stats.users} />
              <StatCard icon="🆕" label="Shu hafta yangi" value={stats.newThisWeek} tone="gold" />
              <StatCard icon="🟢" label="Bugun faol" value={stats.activeToday} tone="sky" />
              <StatCard icon="👑" label="Adminlar" value={(stats.byRole?.admin || 0) + (stats.byRole?.superadmin || 0)} tone="gold" />
            </>
          )}
          <StatCard icon="🤖" label="Bugungi AI so'rovlar" value={stats.aiToday} tone="brick" />
          <StatCard icon="🔑" label="Faol API kalitlar" value={stats.activeKeys} />
          <StatCard icon="🗂️" label="Yuklangan materiallar" value={Object.values(stats.mediaByKind || {}).reduce((a, b) => a + b, 0)} tone="sky" />
          <StatCard icon="📰" label="Yangiliklar" value={stats.mediaByKind?.news || 0} tone="brick" />
        </div>
      )}
      {content && (
        <div className="card p-5 overflow-x-auto">
          <div className="h2 mb-3">Kurs kontenti</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider muted">
                <th className="py-2 pr-3">Til</th>
                <th className="py-2 px-2 text-right">Dars</th>
                <th className="py-2 px-2 text-right">Kurs so'zlari</th>
                <th className="py-2 px-2 text-right">Word: so'z</th>
                <th className="py-2 px-2 text-right">Word: ibora</th>
                <th className="py-2 px-2 text-right">Qo'shimcha</th>
                <th className="py-2 px-2 text-right">Dialog</th>
                <th className="py-2 px-2 text-right">Mashq</th>
                <th className="py-2 pl-2 text-right">Fe'l</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(content).map(([k, s]) => (
                <tr key={k} className="border-t" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>
                  <td className="py-2 pr-3 font-bold whitespace-nowrap">
                    {s.flag} {s.title}
                  </td>
                  <td className="py-2 px-2 text-right">{s.lessons}</td>
                  <td className="py-2 px-2 text-right">{s.courseVocab}</td>
                  <td className="py-2 px-2 text-right">{s.wordbank}</td>
                  <td className="py-2 px-2 text-right">{s.phrasebank}</td>
                  <td className="py-2 px-2 text-right">{s.extraVocab}</td>
                  <td className="py-2 px-2 text-right">{s.dialogs}</td>
                  <td className="py-2 px-2 text-right">{s.exercises}</td>
                  <td className="py-2 pl-2 text-right">{s.verbs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// AI VA API KALITLAR
// =====================================================================
function AiTab({ me }) {
  const isSuper = me.role === 'superadmin';
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [keys, setKeys] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState('');
  const [keyForm, setKeyForm] = useState({ provider: 'gemini', label: '', keyValue: '', model: '', baseUrl: '', priority: 100 });
  const [adding, setAdding] = useState(false);
  const [tests, setTests] = useState({});
  const [editKey, setEditKey] = useState(null);

  const refresh = useCallback(() => {
    api
      .getAiSettings()
      .then((s) => {
        setSettings(s);
        setForm({ provider: s.configuredProvider, geminiModel: s.models?.gemini || 'gemini-flash-latest', dailyLimit: s.dailyLimit, tutorStyle: s.tutorStyle || '' });
      })
      .catch((e) => setError(e.message));
    api
      .listApiKeys()
      .then((r) => setKeys(r.keys))
      .catch(() => setKeys([]));
  }, []);
  useEffect(refresh, [refresh]);

  async function saveSettings(e) {
    e.preventDefault();
    setMsg(null);
    try {
      const s = await api.saveAiSettings(form);
      setSettings(s);
      setMsg({ ok: true, text: s.provider === 'mock' ? "Saqlandi — AI hozir oddiy rejimda (faol kalit yo'q yoki o'chirilgan)." : `Saqlandi — AI faol (${s.activeKeyCount} ta kalit).` });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  async function addKey(e) {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      const res = await api.addApiKey(keyForm);
      setKeyForm({ provider: keyForm.provider, label: '', keyValue: '', model: '', baseUrl: '', priority: 100 });
      refresh();
      if (res.id) testKey(res.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function testKey(id) {
    setTests((t) => ({ ...t, [id]: { loading: true } }));
    try {
      const r = await api.aiTestKey(id);
      setTests((t) => ({ ...t, [id]: r }));
      api.listApiKeys().then((x) => setKeys(x.keys)).catch(() => {});
    } catch (err) {
      setTests((t) => ({ ...t, [id]: { ok: false, error: err.message } }));
    }
  }

  async function keyAction(fn) {
    setError('');
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const preset = PROVIDERS[keyForm.provider];

  return (
    <div className="space-y-5">
      {error && <div className="alert alert-error">{error}</div>}
      {settings && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className="text-2xl">🤖</span>
            <div className="flex-1 min-w-[200px]">
              <div className="h2">AI ustoz holati</div>
              <div className="text-sm muted">
                {settings.provider === 'mock'
                  ? "Oddiy rejim: AI kalit yo'q yoki o'chirilgan. Pastdan kalit qo'shing."
                  : `Faol: ${PROVIDERS[settings.provider]?.label || settings.provider} · ${settings.activeKeyCount} ta faol kalit. Biri xato bersa, avtomatik keyingisiga o'tadi.`}
              </div>
            </div>
            <span className={`badge ${settings.provider === 'mock' ? 'badge-gold' : 'badge-pine'}`}>{settings.provider === 'mock' ? 'Oddiy rejim' : 'AI faol'}</span>
          </div>

          {isSuper && form ? (
            <form onSubmit={saveSettings} className="mt-4 pt-4 border-t grid sm:grid-cols-2 gap-3" style={{ borderColor: 'var(--line)' }}>
              <label className="field">
                <span className="label">Provayder rejimi</span>
                <select className="select" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
                  {PROVIDER_MODES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field !mt-0">
                <span className="label">Gemini modeli</span>
                <input className="input" list="gemini-models" value={form.geminiModel} onChange={(e) => setForm((f) => ({ ...f, geminiModel: e.target.value }))} />
                <datalist id="gemini-models">
                  <option value="gemini-flash-latest" />
                  <option value="gemini-2.5-flash" />
                  <option value="gemini-2.5-flash-lite" />
                  <option value="gemini-2.5-pro" />
                </datalist>
              </label>
              <label className="field !mt-0">
                <span className="label">Kunlik limit (bir o'quvchi uchun, 0 = cheksiz)</span>
                <input type="number" min="0" className="input" value={form.dailyLimit} onChange={(e) => setForm((f) => ({ ...f, dailyLimit: e.target.value }))} />
              </label>
              <label className="field !mt-0 sm:col-span-2">
                <span className="label">Ustozga qo'shimcha ko'rsatma (ixtiyoriy)</span>
                <textarea className="textarea !min-h-[70px]" value={form.tutorStyle} onChange={(e) => setForm((f) => ({ ...f, tutorStyle: e.target.value }))} placeholder="Masalan: Javoblarni juda qisqa yoz, har doim 2 ta misol keltir." />
              </label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <button type="submit" className="btn btn-primary">
                  Saqlash
                </button>
                {msg && <span className={`text-sm ${msg.ok ? '' : ''}`} style={{ color: msg.ok ? 'var(--pine)' : 'var(--brick)' }}>{msg.text}</span>}
              </div>
            </form>
          ) : (
            <p className="text-sm muted mt-3">AI sozlamalari va API kalitlarni faqat super admin o'zgartira oladi.</p>
          )}
        </div>
      )}

      <div className="card p-5">
        <div className="h2 mb-3">🔑 API kalitlar {keys ? `(${keys.length})` : ''}</div>
        {!keys && <div className="skeleton h-24" />}
        {keys?.length === 0 && <div className="text-sm muted mb-3">Hali kalit qo'shilmagan.</div>}
        <div className="space-y-2.5 mb-5">
          {keys?.map((k) => {
            const t = tests[k.id];
            return (
              <div key={k.id} className="card-soft p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: k.isActive ? 'var(--pine)' : 'var(--ink-faint)' }} />
                  <span className="badge badge-sky">{PROVIDERS[k.provider]?.label || k.provider}</span>
                  <span className="font-bold text-sm flex-1 min-w-[120px] truncate" style={{ color: 'var(--ink)' }}>
                    {k.label || 'Nomsiz kalit'}
                  </span>
                  <span className="font-mono text-xs muted">{k.maskedKey}</span>
                </div>
                <div className="text-xs muted mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Model: {k.model || PROVIDERS[k.provider]?.model || 'standart'}</span>
                  {k.baseUrl && <span>URL: {k.baseUrl}</span>}
                  <span>Navbat: {k.priority}</span>
                  <span style={{ color: 'var(--pine)' }}>✓ {k.successCount || 0}</span>
                  {k.failureCount > 0 && <span style={{ color: 'var(--brick)' }}>✗ {k.failureCount} ketma-ket xato</span>}
                  {k.lastUsedAt && <span>Oxirgi: {formatDateTime(k.lastUsedAt)}</span>}
                </div>
                {k.lastError && (
                  <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--brick)' }} title={k.lastError}>
                    {k.lastError}
                  </div>
                )}
                {t && !t.loading && (
                  <div className={`alert mt-2 text-xs ${t.ok ? 'alert-success' : 'alert-error'}`}>
                    {t.ok ? `✅ Ishlayapti (${t.latencyMs} ms): "${t.sample}"` : `❌ ${t.error}`}
                  </div>
                )}
                {isSuper && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => testKey(k.id)} disabled={t?.loading}>
                      {t?.loading ? <span className="spinner" /> : '🧪'} Sinash
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => keyAction(() => api.toggleApiKey(k.id, !k.isActive))}>
                      {k.isActive ? '⏸ O\'chirish' : '▶ Yoqish'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditKey({ id: k.id, label: k.label || '', model: k.model || '', baseUrl: k.baseUrl || '', priority: k.priority, keyValue: '' })}>
                      ✏️ Tahrirlash
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => confirm(`"${k.label || k.maskedKey}" kalitini o'chirasizmi?`) && keyAction(() => api.deleteApiKey(k.id))}
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isSuper && (
          <form onSubmit={addKey} className="pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
            <div className="font-bold mb-3" style={{ color: 'var(--ink)' }}>
              + Yangi kalit qo'shish
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="field">
                <span className="label">Provayder</span>
                <select className="select" value={keyForm.provider} onChange={(e) => setKeyForm((f) => ({ ...f, provider: e.target.value }))}>
                  {Object.entries(PROVIDERS).map(([k, p]) => (
                    <option key={k} value={k}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <span className="help">
                  {preset.note}{' '}
                  {preset.link && (
                    <a href={preset.link} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--pine)' }}>
                      Kalit olish →
                    </a>
                  )}
                </span>
              </label>
              <label className="field !mt-0">
                <span className="label">Nomi (ixtiyoriy)</span>
                <input className="input" value={keyForm.label} onChange={(e) => setKeyForm((f) => ({ ...f, label: e.target.value }))} placeholder="Masalan: Asosiy Gemini" />
              </label>
              <label className="field !mt-0 sm:col-span-2">
                <span className="label">API kalit</span>
                <input className="input font-mono" value={keyForm.keyValue} onChange={(e) => setKeyForm((f) => ({ ...f, keyValue: e.target.value }))} placeholder={keyForm.provider === 'gemini' ? 'AIzaSy…' : 'sk-…'} required autoComplete="off" />
              </label>
              <label className="field !mt-0">
                <span className="label">Model (ixtiyoriy)</span>
                <input className="input" value={keyForm.model} onChange={(e) => setKeyForm((f) => ({ ...f, model: e.target.value }))} placeholder={preset.model || 'model nomi'} required={keyForm.provider === 'custom'} />
              </label>
              <label className="field !mt-0">
                <span className="label">Navbat (kichik raqam — birinchi)</span>
                <input type="number" className="input" value={keyForm.priority} onChange={(e) => setKeyForm((f) => ({ ...f, priority: e.target.value }))} />
              </label>
              {(keyForm.provider === 'custom' || keyForm.baseUrl) && (
                <label className="field !mt-0 sm:col-span-2">
                  <span className="label">Base URL</span>
                  <input className="input" value={keyForm.baseUrl} onChange={(e) => setKeyForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://…/v1" required={keyForm.provider === 'custom'} />
                </label>
              )}
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={adding || !keyForm.keyValue.trim()}>
              {adding ? <><span className="spinner" /> Qo'shilmoqda…</> : "+ Kalit qo'shish va sinash"}
            </button>
            <p className="text-xs faint mt-3">
              Kalitlar Supabase bazasida saqlanadi va hech qachon brauzerga chiqmaydi (faqat maskalangan holda ko'rsatiladi). Bir nechta kalit qo'shsangiz, biri limitga yetganda
              tizim avtomatik keyingisiga o'tadi.
            </p>
          </form>
        )}
      </div>

      <Modal open={!!editKey} onClose={() => setEditKey(null)} title="Kalitni tahrirlash">
        {editKey && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await keyAction(() => api.updateApiKey(editKey));
              setEditKey(null);
            }}
            className="space-y-3"
          >
            <label className="field">
              <span className="label">Nomi</span>
              <input className="input" value={editKey.label} onChange={(e) => setEditKey({ ...editKey, label: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Model</span>
              <input className="input" value={editKey.model} onChange={(e) => setEditKey({ ...editKey, model: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Base URL</span>
              <input className="input" value={editKey.baseUrl} onChange={(e) => setEditKey({ ...editKey, baseUrl: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Navbat</span>
              <input type="number" className="input" value={editKey.priority} onChange={(e) => setEditKey({ ...editKey, priority: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Yangi kalit qiymati (bo'sh qoldirsangiz o'zgarmaydi)</span>
              <input className="input font-mono" value={editKey.keyValue} onChange={(e) => setEditKey({ ...editKey, keyValue: e.target.value })} autoComplete="off" />
            </label>
            <button type="submit" className="btn btn-primary">
              Saqlash
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

// =====================================================================
// MATERIALLAR
// =====================================================================
function ContentTab() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    api.mediaCounts().then(setCounts).catch(() => {});
  }, []);
  return (
    <div>
      <p className="muted mb-4 text-sm">
        Har bir bo'limga o'tib "+ Yuklash" tugmasini bosing. Yuklangan materiallar chap menyudagi "Materiallar" bo'limida ketma-ketlikda ko'rinadi; ↑↓ tugmalari bilan tartibini
        o'zgartirish, darsga biriktirish va yashirish mumkin.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MEDIA_ORDER.map((k) => (
          <Link key={k} to={`/media/${k}`} className="card card-hover p-4 flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'var(--gold-soft)' }}>
              {MEDIA_META[k].icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ color: 'var(--ink)' }}>
                {MEDIA_META[k].label}
              </div>
              <div className="text-xs muted">{counts[k] || 0} ta material</div>
            </div>
            <span className="btn btn-soft btn-sm">Yuklash</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// BOSH KO'RINISH — katta oynalar: bosilganda tegishli bo'lim ochiladi
// =====================================================================
function AdminHome({ me, open }) {
  const isSuper = me.role === 'superadmin';
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [ai, setAi] = useState(null);
  const [mail, setMail] = useState(null);
  useEffect(() => {
    api.adminStats().then(setStats).catch(() => {});
    // Foydalanuvchilar ro'yxati — faqat super admin uchun
    if (isSuper) api.listAdminUsers().then((r) => setRecent(r.users || [])).catch(() => setRecent([]));
    api.getAiSettings().then(setAi).catch(() => {});
    api.getMailSettings().then(setMail).catch(() => {});
  }, [isSuper]);

  const users = recent || [];
  const learners = users.filter((u) => u.role === 'user').length;
  const staff = users.length - learners;
  const newest = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const mediaTotal = stats ? Object.values(stats.mediaByKind || {}).reduce((a, b) => a + b, 0) : null;

  return (
    <div className="space-y-6">
      {mail && !mail.configured && (
        <button type="button" onClick={() => open('mail')} className="alert alert-warn w-full text-left flex items-center gap-3 cursor-pointer">
          <span className="text-2xl">✉️</span>
          <span className="flex-1 text-sm">
            <b>Email xizmati sozlanmagan</b> — email bilan ro'yxatdan o'tish va parolni tiklash ishlamaydi (telefon bilan ishlaydi). Sozlash uchun bosing →
          </span>
        </button>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isSuper ? (
          /* Foydalanuvchilar oynasi — eng katta (faqat super admin) */
          <button
            type="button"
            onClick={() => open('users')}
            className="hero-card p-5 text-left sm:col-span-2 cursor-pointer transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start gap-4">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: 'rgba(255,255,255,.16)' }}>
                👥
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">Foydalanuvchilar</div>
                <div className="font-display text-4xl font-semibold leading-tight">{recent ? users.length : '…'}</div>
                <div className="text-sm opacity-90 mt-1">
                  {learners} o'quvchi · {staff} admin
                  {stats?.activeToday != null ? ` · bugun faol ${stats.activeToday} · shu hafta yangi ${stats.newThisWeek}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-sm" style={{ background: '#fff', color: '#0c5444' }}>
              Ro'yxatni ochish →
            </div>
          </button>
        ) : (
          /* Oddiy admin uchun asosiy oyna — materiallar */
          <button
            type="button"
            onClick={() => open('content')}
            className="hero-card p-5 text-left sm:col-span-2 cursor-pointer transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start gap-4">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: 'rgba(255,255,255,.16)' }}>
                🗂️
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">Materiallar</div>
                <div className="font-display text-4xl font-semibold leading-tight">{mediaTotal == null ? '…' : mediaTotal}</div>
                <div className="text-sm opacity-90 mt-1">Musiqa, video, rasm, matn, dialog, lug'at va yangiliklar</div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-sm" style={{ background: '#fff', color: '#0c5444' }}>
              Yuklash va boshqarish →
            </div>
          </button>
        )}

        <button type="button" onClick={() => open('ai')} className="card card-hover p-5 text-left cursor-pointer">
          <div className="text-3xl mb-2">🤖</div>
          <div className="font-bold" style={{ color: 'var(--ink)' }}>
            AI va API kalitlar
          </div>
          <div className="text-sm muted">
            {ai ? (ai.provider === 'mock' ? 'Oddiy rejim — kalit qo\'shing' : `Faol · ${ai.activeKeyCount} ta kalit`) : '…'}
          </div>
          {stats && <div className="text-xs faint mt-1">Bugun {stats.aiToday} ta so'rov</div>}
        </button>

        {isSuper ? (
          <button type="button" onClick={() => open('content')} className="card card-hover p-5 text-left cursor-pointer">
            <div className="text-3xl mb-2">🗂️</div>
            <div className="font-bold" style={{ color: 'var(--ink)' }}>
              Materiallar
            </div>
            <div className="text-sm muted">{mediaTotal == null ? '…' : `${mediaTotal} ta yuklangan`}</div>
            <div className="text-xs faint mt-1">Musiqa, video, matn, dialog…</div>
          </button>
        ) : (
          <button type="button" onClick={() => open('mail')} className="card card-hover p-5 text-left cursor-pointer">
            <div className="text-3xl mb-2">✉️</div>
            <div className="font-bold" style={{ color: 'var(--ink)' }}>
              Email xizmati
            </div>
            <div className="text-sm muted">{mail ? (mail.configured ? 'Sozlangan' : 'Sozlanmagan') : '…'}</div>
            <div className="text-xs faint mt-1">Tasdiqlash kodlari</div>
          </button>
        )}
      </div>

      <div className={isSuper ? 'grid lg:grid-cols-[1.4fr_1fr] gap-5' : 'grid gap-5 max-w-xl'}>
        {isSuper && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="h2">🆕 So'nggi ro'yxatdan o'tganlar</div>
            <button type="button" className="text-sm font-bold" style={{ color: 'var(--pine)' }} onClick={() => open('users')}>
              Barchasi →
            </button>
          </div>
          {!recent && <div className="skeleton h-32" />}
          {recent && newest.length === 0 && <div className="text-sm muted">Hali foydalanuvchi yo'q.</div>}
          <div className="space-y-1.5">
            {newest.map((u) => (
              <button key={u.id} type="button" onClick={() => open('users')} className="w-full card-soft px-3 py-2.5 flex items-center gap-3 text-left">
                <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: 'var(--paper-soft)', color: 'var(--ink)' }}>
                  {(u.displayName || u.username || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {u.displayName || u.username}
                  </span>
                  <span className="block text-xs muted truncate">{u.email || (u.phone ? formatPhone(u.phone) : `@${u.username}`)}</span>
                </span>
                <span className="text-xs faint whitespace-nowrap">{formatDate(u.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
        )}
        <div className="card p-5">
          <div className="h2 mb-3">⚡ Tezkor amallar</div>
          <div className="grid gap-2">
            {isSuper && (
              <button type="button" className="btn btn-gold btn-block" onClick={() => open('users', { add: '1' })}>
                + Foydalanuvchi yoki admin qo'shish
              </button>
            )}
            <Link to="/media/news" className="btn btn-ghost btn-block">
              📰 Yangilik e'lon qilish
            </Link>
            <Link to="/media/audio" className="btn btn-ghost btn-block">
              🎵 Musiqa / audio yuklash
            </Link>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => open('stats')}>
              📊 To'liq statistika
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const isSuper = user.role === 'superadmin';
  const [params, setParams] = useSearchParams();
  // "Foydalanuvchilar" bo'limi faqat super admin uchun; oddiy admin uni ko'rmaydi va havola orqali ham ocholmaydi
  const tabs = TABS.filter(([k]) => k !== 'users' || isSuper);
  const requested = params.get('tab') || 'home';
  const tab = tabs.some(([k]) => k === requested) ? requested : 'home';
  const open = (k, extra = {}) => {
    setParams({ tab: k, ...extra });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Layout>
      <div className="page-wide">
        <PageHeader eyebrow="Boshqaruv" title="Admin panel" subtitle={`${ROLE_LABEL[user.role]} · ${user.displayName || user.username}`} />
        <div className="tabs mb-6">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" className={`chip ${tab === k ? 'chip-active' : ''}`} onClick={() => open(k)}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'home' && <AdminHome me={user} open={open} />}
        {tab === 'users' && isSuper && <UsersPanel me={user} openForm={params.get('add') === '1'} />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'ai' && <AiTab me={user} />}
        {tab === 'mail' && <MailPanel me={user} />}
        {tab === 'content' && <ContentTab />}
      </div>
    </Layout>
  );
}
