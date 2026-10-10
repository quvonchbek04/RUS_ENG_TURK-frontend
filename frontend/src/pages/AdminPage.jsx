import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { Modal, PageHeader, StatCard, formatDate, formatDateTime } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { MEDIA_META, MEDIA_ORDER, canUploadKind, uploadableKinds } from '../lib/media.js';
import { formatPhone } from '../lib/identity.js';
import { FUNC_PERM_KEYS, ROLE_LABEL, can } from '../lib/roles.js';
import { t } from '../i18n/index.js';
import UsersPanel from './admin/UsersPanel.jsx';
import MailPanel from './admin/MailPanel.jsx';
import PermissionsPanel from './admin/PermissionsPanel.jsx';
import SignupPanel from './admin/SignupPanel.jsx';

// Izohlar o'zbekcha kalit sifatida saqlanadi, chiqarishda t() bilan o'giriladi.
const PROVIDERS = {
  gemini: { label: 'Google Gemini', link: 'https://aistudio.google.com/apikey', model: 'gemini-flash-latest', note: 'Bepul kalit beriladi. Tavsiya etiladi.' },
  openai: { label: 'OpenAI (ChatGPT)', link: 'https://platform.openai.com/api-keys', model: 'gpt-4o-mini', note: "Pullik, hisobda balans bo'lishi kerak." },
  groq: { label: 'Groq (Llama)', link: 'https://console.groq.com/keys', model: 'llama-3.3-70b-versatile', note: 'Bepul limit bilan, juda tez.' },
  openrouter: { label: 'OpenRouter', link: 'https://openrouter.ai/keys', model: 'openrouter/auto', note: "Ko'plab modellarga bitta kalit." },
  deepseek: { label: 'DeepSeek', link: 'https://platform.deepseek.com/api_keys', model: 'deepseek-chat', note: 'Arzon narxlar.' },
  custom: { label: 'Boshqa (OpenAI-mos API)', link: '', model: '', note: 'Base URL va model nomini kiriting.' },
};
const PROVIDER_MODES = [
  ['auto', "🔄 Avtomatik — qaysi kalit faol bo'lsa"],
  ['gemini', 'Faqat Gemini'],
  ['openai', 'Faqat OpenAI'],
  ['groq', 'Faqat Groq'],
  ['openrouter', 'Faqat OpenRouter'],
  ['deepseek', 'Faqat DeepSeek'],
  ['custom', 'Faqat boshqa (custom)'],
  ['mock', "⛔ AI o'chiq (oddiy rejim)"],
];

// Bo'limlar: [kalit, nom, kerakli ruxsat]. 'super' — faqat super admin; null — har bir admin; aks holda super admin bergan funksiya ruxsati.
const TABS = [
  ['home', '🏠 Umumiy', null],
  ['users', '👥 Foydalanuvchilar', 'users_view'],
  ['perms', '🔐 Ruxsatlar', 'super'],
  ['signup', "🛡️ Ro'yxatdan o'tish", 'super'],
  ['ai', '🤖 AI va API kalitlar', 'ai_view'],
  ['mail', '✉️ Email xizmati', 'mail_view'],
  ['content', '🗂️ Materiallar', null],
  ['stats', '📊 Statistika', 'stats_view'],
];
const tabAllowed = (user, need) => !need || (need === 'super' ? user.role === 'superadmin' : can(user, need));

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
      {error && <div className="alert alert-warn mb-4">{t('Statistika olinmadi: {error}', { error })}</div>}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Foydalanuvchilar bo'yicha raqamlar — faqat super adminga keladi (oddiy adminda null) */}
          {stats.users != null && (
            <>
              <StatCard icon="👥" label={t('Foydalanuvchilar')} value={stats.users} />
              <StatCard icon="🆕" label={t('Shu hafta yangi')} value={stats.newThisWeek} tone="gold" />
              <StatCard icon="🟢" label={t('Bugun faol')} value={stats.activeToday} tone="sky" />
              <StatCard icon="👑" label={t('Adminlar')} value={(stats.byRole?.admin || 0) + (stats.byRole?.superadmin || 0)} tone="gold" />
            </>
          )}
          <StatCard icon="🤖" label={t("Bugungi AI so'rovlar")} value={stats.aiToday} tone="brick" />
          <StatCard icon="🔑" label={t('Faol API kalitlar')} value={stats.activeKeys} />
          <StatCard icon="🗂️" label={t('Yuklangan materiallar')} value={Object.values(stats.mediaByKind || {}).reduce((a, b) => a + b, 0)} tone="sky" />
          <StatCard icon="📰" label={t('Yangiliklar')} value={stats.mediaByKind?.news || 0} tone="brick" />
        </div>
      )}
      {content && (
        <div className="card p-5 overflow-x-auto">
          <div className="h2 mb-3">{t('Kurs kontenti')}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider muted">
                <th className="py-2 pr-3">{t('Til')}</th>
                <th className="py-2 px-2 text-right">{t('Dars')}</th>
                <th className="py-2 px-2 text-right">{t("Kurs so'zlari")}</th>
                <th className="py-2 px-2 text-right">{t("Word: so'z")}</th>
                <th className="py-2 px-2 text-right">{t('Word: ibora')}</th>
                <th className="py-2 px-2 text-right">{t("Qo'shimcha")}</th>
                <th className="py-2 px-2 text-right">{t('Dialog')}</th>
                <th className="py-2 px-2 text-right">{t('Mashq')}</th>
                <th className="py-2 pl-2 text-right">{t("Fe'l")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(content).map(([k, s]) => (
                <tr key={k} className="border-t" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>
                  <td className="py-2 pr-3 font-bold whitespace-nowrap">
                    {s.flag} {t(s.title)}
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
      setMsg({
        ok: true,
        text: s.provider === 'mock' ? t("Saqlandi — AI hozir oddiy rejimda (faol kalit yo'q yoki o'chirilgan).") : t('Saqlandi — AI faol ({n} ta kalit).', { n: s.activeKeyCount }),
      });
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
    setTests((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const r = await api.aiTestKey(id);
      setTests((prev) => ({ ...prev, [id]: r }));
      api.listApiKeys().then((x) => setKeys(x.keys)).catch(() => {});
    } catch (err) {
      setTests((prev) => ({ ...prev, [id]: { ok: false, error: err.message } }));
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
              <div className="h2">{t('AI ustoz holati')}</div>
              <div className="text-sm muted">
                {settings.provider === 'mock'
                  ? t("Oddiy rejim: AI kalit yo'q yoki o'chirilgan. Pastdan kalit qo'shing.")
                  : t("Faol: {name} · {n} ta faol kalit. Biri xato bersa, avtomatik keyingisiga o'tadi.", { name: PROVIDERS[settings.provider]?.label || settings.provider, n: settings.activeKeyCount })}
              </div>
            </div>
            <span className={`badge ${settings.provider === 'mock' ? 'badge-gold' : 'badge-pine'}`}>{settings.provider === 'mock' ? t('Oddiy rejim') : t('AI faol')}</span>
          </div>

          {isSuper && form ? (
            <form onSubmit={saveSettings} className="mt-4 pt-4 border-t grid sm:grid-cols-2 gap-3" style={{ borderColor: 'var(--line)' }}>
              <label className="field">
                <span className="label">{t('Provayder rejimi')}</span>
                <select className="select" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
                  {PROVIDER_MODES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field !mt-0">
                <span className="label">{t('Gemini modeli')}</span>
                <input className="input" list="gemini-models" value={form.geminiModel} onChange={(e) => setForm((f) => ({ ...f, geminiModel: e.target.value }))} />
                <datalist id="gemini-models">
                  <option value="gemini-flash-latest" />
                  <option value="gemini-2.5-flash" />
                  <option value="gemini-2.5-flash-lite" />
                  <option value="gemini-2.5-pro" />
                </datalist>
              </label>
              <label className="field !mt-0">
                <span className="label">{t("Kunlik limit (bir o'quvchi uchun, 0 = cheksiz)")}</span>
                <input type="number" min="0" className="input" value={form.dailyLimit} onChange={(e) => setForm((f) => ({ ...f, dailyLimit: e.target.value }))} />
              </label>
              <label className="field !mt-0 sm:col-span-2">
                <span className="label">{t("Ustozga qo'shimcha ko'rsatma (ixtiyoriy)")}</span>
                <textarea
                  className="textarea !min-h-[70px]"
                  value={form.tutorStyle}
                  onChange={(e) => setForm((f) => ({ ...f, tutorStyle: e.target.value }))}
                  placeholder={t('Masalan: Javoblarni juda qisqa yoz, har doim 2 ta misol keltir.')}
                />
              </label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <button type="submit" className="btn btn-primary">
                  {t('Saqlash')}
                </button>
                {msg && (
                  <span className="text-sm" style={{ color: msg.ok ? 'var(--pine)' : 'var(--brick)' }}>
                    {msg.text}
                  </span>
                )}
              </div>
            </form>
          ) : (
            <p className="text-sm muted mt-3">{t("AI sozlamalari va API kalitlarni faqat super admin o'zgartira oladi.")}</p>
          )}
        </div>
      )}

      <div className="card p-5">
        <div className="h2 mb-3">
          {t('🔑 API kalitlar')} {keys ? `(${keys.length})` : ''}
        </div>
        {!keys && <div className="skeleton h-24" />}
        {keys?.length === 0 && <div className="text-sm muted mb-3">{t("Hali kalit qo'shilmagan.")}</div>}
        <div className="space-y-2.5 mb-5">
          {keys?.map((k) => {
            const test = tests[k.id];
            return (
              <div key={k.id} className="card-soft p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: k.isActive ? 'var(--pine)' : 'var(--ink-faint)' }} />
                  <span className="badge badge-sky">{PROVIDERS[k.provider]?.label || k.provider}</span>
                  <span className="font-bold text-sm flex-1 min-w-[120px] truncate" style={{ color: 'var(--ink)' }}>
                    {k.label || t('Nomsiz kalit')}
                  </span>
                  <span className="font-mono text-xs muted">{k.maskedKey}</span>
                </div>
                <div className="text-xs muted mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{t('Model: {name}', { name: k.model || PROVIDERS[k.provider]?.model || t('standart') })}</span>
                  {k.baseUrl && <span>URL: {k.baseUrl}</span>}
                  <span>{t('Navbat: {n}', { n: k.priority })}</span>
                  <span style={{ color: 'var(--pine)' }}>✓ {k.successCount || 0}</span>
                  {k.failureCount > 0 && <span style={{ color: 'var(--brick)' }}>{t('✗ {n} ketma-ket xato', { n: k.failureCount })}</span>}
                  {k.lastUsedAt && <span>{t('Oxirgi: {date}', { date: formatDateTime(k.lastUsedAt) })}</span>}
                </div>
                {k.lastError && (
                  <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--brick)' }} title={k.lastError}>
                    {k.lastError}
                  </div>
                )}
                {test && !test.loading && (
                  <div className={`alert mt-2 text-xs ${test.ok ? 'alert-success' : 'alert-error'}`}>
                    {test.ok ? t('✅ Ishlayapti ({ms} ms): "{sample}"', { ms: test.latencyMs, sample: test.sample }) : `❌ ${test.error}`}
                  </div>
                )}
                {isSuper && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => testKey(k.id)} disabled={test?.loading}>
                      {test?.loading ? <span className="spinner" /> : '🧪'} {t('Sinash')}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => keyAction(() => api.toggleApiKey(k.id, !k.isActive))}>
                      {k.isActive ? t("⏸ O'chirish") : t('▶ Yoqish')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditKey({ id: k.id, label: k.label || '', model: k.model || '', baseUrl: k.baseUrl || '', priority: k.priority, keyValue: '' })}
                    >
                      {t('✏️ Tahrirlash')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => confirm(t('"{name}" kalitini o\'chirasizmi?', { name: k.label || k.maskedKey })) && keyAction(() => api.deleteApiKey(k.id))}
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
              {t("+ Yangi kalit qo'shish")}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="field">
                <span className="label">{t('Provayder')}</span>
                <select className="select" value={keyForm.provider} onChange={(e) => setKeyForm((f) => ({ ...f, provider: e.target.value }))}>
                  {Object.entries(PROVIDERS).map(([k, p]) => (
                    <option key={k} value={k}>
                      {t(p.label)}
                    </option>
                  ))}
                </select>
                <span className="help">
                  {t(preset.note)}{' '}
                  {preset.link && (
                    <a href={preset.link} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--pine)' }}>
                      {t('Kalit olish →')}
                    </a>
                  )}
                </span>
              </label>
              <label className="field !mt-0">
                <span className="label">{t('Nomi (ixtiyoriy)')}</span>
                <input className="input" value={keyForm.label} onChange={(e) => setKeyForm((f) => ({ ...f, label: e.target.value }))} placeholder={t('Masalan: Asosiy Gemini')} />
              </label>
              <label className="field !mt-0 sm:col-span-2">
                <span className="label">{t('API kalit')}</span>
                <input
                  className="input font-mono"
                  value={keyForm.keyValue}
                  onChange={(e) => setKeyForm((f) => ({ ...f, keyValue: e.target.value }))}
                  placeholder={keyForm.provider === 'gemini' ? 'AIzaSy…' : 'sk-…'}
                  required
                  autoComplete="off"
                />
              </label>
              <label className="field !mt-0">
                <span className="label">{t('Model (ixtiyoriy)')}</span>
                <input className="input" value={keyForm.model} onChange={(e) => setKeyForm((f) => ({ ...f, model: e.target.value }))} placeholder={preset.model || t('model nomi')} required={keyForm.provider === 'custom'} />
              </label>
              <label className="field !mt-0">
                <span className="label">{t('Navbat (kichik raqam — birinchi)')}</span>
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
              {adding ? <><span className="spinner" /> {t("Qo'shilmoqda…")}</> : t("+ Kalit qo'shish va sinash")}
            </button>
            <p className="text-xs faint mt-3">
              {t("Kalitlar Supabase bazasida saqlanadi va hech qachon brauzerga chiqmaydi (faqat maskalangan holda ko'rsatiladi). Bir nechta kalit qo'shsangiz, biri limitga yetganda tizim avtomatik keyingisiga o'tadi.")}
            </p>
          </form>
        )}
      </div>

      <Modal open={!!editKey} onClose={() => setEditKey(null)} title={t('Kalitni tahrirlash')}>
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
              <span className="label">{t('Nomi')}</span>
              <input className="input" value={editKey.label} onChange={(e) => setEditKey({ ...editKey, label: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">{t('Model')}</span>
              <input className="input" value={editKey.model} onChange={(e) => setEditKey({ ...editKey, model: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Base URL</span>
              <input className="input" value={editKey.baseUrl} onChange={(e) => setEditKey({ ...editKey, baseUrl: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">{t('Navbat')}</span>
              <input type="number" className="input" value={editKey.priority} onChange={(e) => setEditKey({ ...editKey, priority: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">{t("Yangi kalit qiymati (bo'sh qoldirsangiz o'zgarmaydi)")}</span>
              <input className="input font-mono" value={editKey.keyValue} onChange={(e) => setEditKey({ ...editKey, keyValue: e.target.value })} autoComplete="off" />
            </label>
            <button type="submit" className="btn btn-primary">
              {t('Saqlash')}
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
function ContentTab({ me }) {
  const [counts, setCounts] = useState({});
  const isSuper = me.role === 'superadmin';
  const allowed = uploadableKinds(me);
  useEffect(() => {
    api.mediaCounts().then(setCounts).catch(() => {});
  }, []);
  return (
    <div>
      <p className="muted mb-4 text-sm">
        {t('Har bir bo\'limga o\'tib "+ Yuklash" tugmasini bosing. Yuklangan materiallar chap menyudagi "Materiallar" bo\'limida ketma-ketlikda ko\'rinadi; ↑↓ tugmalari bilan tartibini o\'zgartirish, darsga biriktirish va yashirish mumkin.')}
      </p>
      {!isSuper && (
        <div className={`alert text-sm mb-4 ${allowed.length ? 'alert-info' : 'alert-warn'}`}>
          {allowed.length
            ? t("Sizga ruxsat berilgan bo'limlar: {list}. Qolgan bo'limlarni faqat ko'ra olasiz.", { list: allowed.map((k) => MEDIA_META[k].short).join(', ') })
            : t("Sizga hali material yuklash ruxsati berilmagan. Ruxsat olish uchun super admin bilan bog'laning.")}
        </div>
      )}
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
              <div className="text-xs muted">{t('{n} ta material', { n: counts[k] || 0 })}</div>
            </div>
            {canUploadKind(me, k) ? <span className="btn btn-soft btn-sm">{t('Yuklash')}</span> : <span className="badge">{t("🔒 Faqat ko'rish")}</span>}
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
  // Har bir so'rov faqat tegishli ruxsat bo'lsa yuboriladi (server baribir ruxsatsiz so'rovni rad etadi)
  const canUsers = can(me, 'users_view');
  const canAi = can(me, 'ai_view');
  const canMail = can(me, 'mail_view');
  const canStats = can(me, 'stats_view');
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [ai, setAi] = useState(null);
  const [mail, setMail] = useState(null);
  const [mediaCounts, setMediaCounts] = useState(null);
  useEffect(() => {
    // Materiallar soni hamma uchun ochiq (statistika ruxsati shart emas)
    api.mediaCounts().then(setMediaCounts).catch(() => {});
    if (canStats) api.adminStats().then(setStats).catch(() => {});
    // Foydalanuvchilar ro'yxati — super admin hammani, ruxsati bor admin faqat o'quvchilarni oladi
    if (canUsers) api.listAdminUsers().then((r) => setRecent(r.users || [])).catch(() => setRecent([]));
    if (canAi) api.getAiSettings().then(setAi).catch(() => {});
    if (canMail) api.getMailSettings().then(setMail).catch(() => {});
  }, [canStats, canUsers, canAi, canMail]);

  const users = recent || [];
  const learners = users.filter((u) => u.role === 'user').length;
  const staff = users.length - learners;
  const newest = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const mediaTotal = mediaCounts ? Object.values(mediaCounts).reduce((a, b) => a + b, 0) : null;
  const allowedKinds = uploadableKinds(me);
  const funcCount = FUNC_PERM_KEYS.filter((k) => can(me, k)).length;

  return (
    <div className="space-y-6">
      {!isSuper && (
        <Link to="/profile#perms" className="alert alert-info w-full text-left flex items-center gap-3">
          <span className="text-2xl">🔐</span>
          <span className="flex-1 text-sm">
            <b>{t('Mening ruxsatlarim')}</b> — {t("{a} ta bo'limga yuklash va {b} ta funksiya ruxsat etilgan.", { a: allowedKinds.length, b: funcCount })} {t("Batafsil →")}
          </span>
        </Link>
      )}
      {canMail && mail && !mail.configured && (
        <button type="button" onClick={() => open('mail')} className="alert alert-warn w-full text-left flex items-center gap-3 cursor-pointer">
          <span className="text-2xl">✉️</span>
          <span className="flex-1 text-sm">
            <b>{t('Email xizmati sozlanmagan')}</b> —{' '}
            {mail.signupNeedsMail === false
              ? t("parolni email orqali tiklash ishlamaydi (email bilan ro'yxatdan o'tish kodsiz ishlayapti yoki o'chirilgan).")
              : t("email bilan ro'yxatdan o'tish (kod bilan) va parolni tiklash ishlamaydi (telefon yoki oddiy usul ishlaydi).")}{' '}
            {t('Sozlash uchun bosing →')}
          </span>
        </button>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {canUsers ? (
          /* Foydalanuvchilar oynasi — eng katta (super admin va "o'quvchilarni ko'rish" ruxsati bor admin) */
          <button type="button" onClick={() => open('users')} className="hero-card p-5 text-left sm:col-span-2 cursor-pointer transition-transform hover:-translate-y-0.5">
            <div className="flex items-start gap-4">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: 'rgba(255,255,255,.16)' }}>
                👥
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">{t('Foydalanuvchilar')}</div>
                <div className="font-display text-4xl font-semibold leading-tight">{recent ? users.length : '…'}</div>
                <div className="text-sm opacity-90 mt-1">
                  {isSuper ? t("{a} o'quvchi · {b} admin", { a: learners, b: staff }) : t("{a} o'quvchi", { a: learners })}
                  {stats?.activeToday != null ? t(' · bugun faol {a} · shu hafta yangi {b}', { a: stats.activeToday, b: stats.newThisWeek }) : ''}
                </div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-sm" style={{ background: '#fff', color: '#0c5444' }}>
              {t("Ro'yxatni ochish →")}
            </div>
          </button>
        ) : (
          /* Oddiy admin uchun asosiy oyna — materiallar */
          <button type="button" onClick={() => open('content')} className="hero-card p-5 text-left sm:col-span-2 cursor-pointer transition-transform hover:-translate-y-0.5">
            <div className="flex items-start gap-4">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: 'rgba(255,255,255,.16)' }}>
                🗂️
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">{t('Materiallar')}</div>
                <div className="font-display text-4xl font-semibold leading-tight">{mediaTotal == null ? '…' : mediaTotal}</div>
                <div className="text-sm opacity-90 mt-1">
                  {allowedKinds.length
                    ? t('Sizga ruxsat: {list}', { list: allowedKinds.map((k) => MEDIA_META[k].short).join(', ') })
                    : t("Yuklash ruxsati hali berilmagan — super admin bilan bog'laning")}
                </div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-sm" style={{ background: '#fff', color: '#0c5444' }}>
              {allowedKinds.length ? t('Yuklash va boshqarish →') : t("Materiallarni ko'rish →")}
            </div>
          </button>
        )}

        {canAi && (
          <button type="button" onClick={() => open('ai')} className="card card-hover p-5 text-left cursor-pointer">
            <div className="text-3xl mb-2">🤖</div>
            <div className="font-bold" style={{ color: 'var(--ink)' }}>
              {t('AI va API kalitlar')}
            </div>
            <div className="text-sm muted">{ai ? (ai.provider === 'mock' ? t("Oddiy rejim — kalit qo'shing") : t('Faol · {n} ta kalit', { n: ai.activeKeyCount })) : '…'}</div>
            {stats && <div className="text-xs faint mt-1">{t("Bugun {n} ta so'rov", { n: stats.aiToday })}</div>}
          </button>
        )}

        {isSuper ? (
          <button type="button" onClick={() => open('signup')} className="card card-hover p-5 text-left cursor-pointer">
            <div className="text-3xl mb-2">🛡️</div>
            <div className="font-bold" style={{ color: 'var(--ink)' }}>
              {t("Ro'yxatdan o'tish")}
            </div>
            <div className="text-sm muted">{t('Usullar, email kodi, Telegram')}</div>
            <div className="text-xs faint mt-1">{t('Kim qanday ro\'yxatdan o\'tishini siz belgilaysiz')}</div>
          </button>
        ) : (
          canMail && (
            <button type="button" onClick={() => open('mail')} className="card card-hover p-5 text-left cursor-pointer">
              <div className="text-3xl mb-2">✉️</div>
              <div className="font-bold" style={{ color: 'var(--ink)' }}>
                {t('Email xizmati')}
              </div>
              <div className="text-sm muted">{mail ? (mail.configured ? t('Sozlangan') : t('Sozlanmagan')) : '…'}</div>
              <div className="text-xs faint mt-1">{t('Tasdiqlash kodlari')}</div>
            </button>
          )
        )}
      </div>

      <div className={canUsers ? 'grid lg:grid-cols-[1.4fr_1fr] gap-5' : 'grid gap-5 max-w-xl'}>
        {canUsers && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h2">{t("🆕 So'nggi ro'yxatdan o'tganlar")}</div>
              <button type="button" className="text-sm font-bold" style={{ color: 'var(--pine)' }} onClick={() => open('users')}>
                {t('Barchasi →')}
              </button>
            </div>
            {!recent && <div className="skeleton h-32" />}
            {recent && newest.length === 0 && <div className="text-sm muted">{t("Hali foydalanuvchi yo'q.")}</div>}
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
          <div className="h2 mb-3">{t('⚡ Tezkor amallar')}</div>
          <div className="grid gap-2">
            {can(me, 'users_add') && canUsers && (
              <button type="button" className="btn btn-gold btn-block" onClick={() => open('users', { add: '1' })}>
                {isSuper ? t("+ Foydalanuvchi yoki admin qo'shish") : t("+ O'quvchi qo'shish")}
              </button>
            )}
            {isSuper && (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => open('perms')}>
                {t('🔐 Adminlar ruxsatlari')}
              </button>
            )}
            {!isSuper && (
              <Link to="/profile#perms" className="btn btn-ghost btn-block">
                {t('🔐 Mening ruxsatlarim')}
              </Link>
            )}
            {canUploadKind(me, 'news') && (
              <Link to="/media/news" className="btn btn-ghost btn-block">
                {t("📰 Yangilik e'lon qilish")}
              </Link>
            )}
            {canUploadKind(me, 'audio') && (
              <Link to="/media/audio" className="btn btn-ghost btn-block">
                {t('🎵 Musiqa / audio yuklash')}
              </Link>
            )}
            {canStats && (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => open('stats')}>
                {t("📊 To'liq statistika")}
              </button>
            )}
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
  // "Ruxsatlar" va "Ro'yxatdan o'tish" — faqat super admin; qolgan bo'limlar (foydalanuvchilar, AI, email, statistika) — faqat
  // super admin ruxsat bergan adminga. Ruxsatsiz admin ularni ko'rmaydi va havola orqali ham ocholmaydi (server ham rad etadi).
  const tabs = TABS.filter(([, , need]) => tabAllowed(user, need));
  const requested = params.get('tab') || 'home';
  const tab = tabs.some(([k]) => k === requested) ? requested : 'home';
  const open = (k, extra = {}) => {
    setParams({ tab: k, ...extra });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Layout>
      <div className="page-wide">
        <PageHeader eyebrow={t('Boshqaruv')} title={t('Admin panel')} subtitle={`${ROLE_LABEL[user.role]} · ${user.displayName || user.username}`} />
        <div className="tabs mb-6">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" className={`chip ${tab === k ? 'chip-active' : ''}`} onClick={() => open(k)}>
              {t(l)}
            </button>
          ))}
        </div>
        {tab === 'home' && <AdminHome me={user} open={open} />}
        {tab === 'users' && <UsersPanel me={user} openForm={params.get('add') === '1' && can(user, 'users_add')} />}
        {tab === 'perms' && isSuper && <PermissionsPanel />}
        {tab === 'signup' && isSuper && <SignupPanel />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'ai' && <AiTab me={user} />}
        {tab === 'mail' && <MailPanel me={user} />}
        {tab === 'content' && <ContentTab me={user} />}
      </div>
    </Layout>
  );
}
