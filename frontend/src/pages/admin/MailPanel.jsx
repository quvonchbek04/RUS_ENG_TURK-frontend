import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { t } from '../../i18n/index.js';
import { Rich } from '../../i18n/react.jsx';

// Matnlar o'zbekcha kalit sifatida saqlanadi va chiqarishda t() bilan o'giriladi.
const PROVIDERS = {
  brevo: {
    label: 'Brevo (Sendinblue)',
    note: "Bepul: kuniga 300 ta xat. Domen shart emas — yuboruvchi email manzilini tasdiqlash kifoya.",
    link: 'https://app.brevo.com/settings/keys/api',
    steps: [
      'brevo.com da bepul hisob oching va emailingizni tasdiqlang.',
      "Settings → Senders, domains & dedicated IPs → Senders → Add a sender: o'zingizning email manzilingizni qo'shing va u yuborilgan tasdiqlash xatidagi havolani bosing.",
      'Settings → SMTP & API → API Keys → Generate a new API key — kalitni nusxalab, pastga joylang.',
      'Yuboruvchi email maydoniga yuqorida tasdiqlagan manzilni yozing.',
    ],
  },
  resend: {
    label: 'Resend',
    note: "Bepul: kuniga 100 ta xat. O'z domeningiz bo'lishi va Resend'da tasdiqlanishi shart.",
    link: 'https://resend.com/api-keys',
    steps: [
      "resend.com da hisob oching → Domains bo'limida domeningizni qo'shib, DNS yozuvlarini tasdiqlang.",
      'API Keys → Create API Key (Sending access) — kalitni nusxalab, pastga joylang.',
      'Yuboruvchi email: tasdiqlangan domeningizdagi manzil (masalan noreply@sizning-domen.uz).',
    ],
  },
};

/** Admin panel → "✉️ Email xizmati": tasdiqlash va parolni tiklash kodlari shu orqali avtomatik yuboriladi.
 *  (Ro'yxatdan o'tishda kod talab qilinadimi — «🛡️ Ro'yxatdan o'tish» bo'limida.) */
export default function MailPanel({ me }) {
  const isSuper = me.role === 'superadmin';
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({ provider: 'brevo', apiKey: '', from: '', fromName: 'Til sayohati' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [testTo, setTestTo] = useState(me.email || '');
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);

  useEffect(() => {
    api
      .getMailSettings()
      .then((s) => {
        setCfg(s);
        setForm({ provider: s.provider || 'brevo', apiKey: '', from: s.from || '', fromName: s.fromName || 'Til sayohati' });
      })
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await api.saveMailSettings(form);
      setCfg((c) => ({ ...c, provider: form.provider, from: form.from, fromName: form.fromName, configured: r.configured, hasKey: !!r.maskedKey, maskedKey: r.maskedKey }));
      setForm((f) => ({ ...f, apiKey: '' }));
      setMsg({ ok: true, text: r.configured ? t('✅ Saqlandi. Endi "Test xat" tugmasi bilan tekshirib ko\'ring.') : t('Saqlandi, lekin API kalit yoki yuboruvchi email hali kiritilmagan.') });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestRes(null);
    try {
      setTestRes(await api.testMail(testTo));
    } catch (err) {
      setTestRes({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  const p = PROVIDERS[form.provider];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">✉️</span>
          <div className="flex-1 min-w-[220px]">
            <div className="h2">{t('Email xizmati')}</div>
            <div className="text-sm muted">
              <Rich text={t("Email bilan ro'yxatdan o'tgan va parolni tiklayotgan foydalanuvchilarga **6 xonali tasdiqlash kodi avtomatik** yuboriladi.")} />
            </div>
          </div>
          {cfg && <span className={`badge ${cfg.configured ? 'badge-pine' : 'badge-brick'}`}>{cfg.configured ? t('✓ Sozlangan') : t('Sozlanmagan')}</span>}
        </div>
        <div className="alert alert-info text-sm mt-4">
          {t("🤖 Kodni admin yubormaydi: server har bir so'rovda yangi tasodifiy kod yaratib, o'zi jo'natadi — admin tizimda bo'lishi shart emas. Sozlamani faqat bir marta kiritasiz.")}
        </div>
        {cfg && !cfg.configured && (
          <div className="alert alert-warn text-sm mt-3">
            {cfg.signupNeedsMail === false
              ? t("Email xizmati sozlanmaguncha parolni email orqali tiklash ishlamaydi.")
              : t("Email xizmati sozlanmaguncha email bilan ro'yxatdan o'tish (kod bilan) va parolni tiklash ishlamaydi. Telefon yoki oddiy usul ishlayveradi.")}
          </div>
        )}
        {isSuper && (
          <p className="text-xs muted mt-3">{t("Ro'yxatdan o'tishda email kodini yoqish yoki o'chirish — «🛡️ Ro'yxatdan o'tish» bo'limida.")}</p>
        )}
      </div>

      {isSuper ? (
        <form onSubmit={save} className="card p-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="field sm:col-span-2">
              <span className="label">{t('Provayder')}</span>
              <select className="select" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
                {Object.entries(PROVIDERS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <span className="help">{t(p.note)}</span>
            </label>
            <label className="field !mt-0 sm:col-span-2">
              <span className="label">
                {t('API kalit')} {cfg?.hasKey && <span className="badge badge-pine ml-1">{t('saqlangan: {key}', { key: cfg.maskedKey })}</span>}
              </span>
              <input
                className="input font-mono"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={cfg?.hasKey ? t("O'zgartirmaslik uchun bo'sh qoldiring") : form.provider === 'brevo' ? 'xkeysib-…' : 're_…'}
                autoComplete="off"
              />
            </label>
            <label className="field !mt-0">
              <span className="label">{t('Yuboruvchi email (tasdiqlangan)')}</span>
              <input type="email" className="input" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} placeholder="noreply@…" required />
            </label>
            <label className="field !mt-0">
              <span className="label">{t('Yuboruvchi nomi')}</span>
              <input className="input" value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> {t('Saqlanmoqda…')}</> : t('Saqlash')}
            </button>
            {msg && <span className="text-sm" style={{ color: msg.ok ? 'var(--pine)' : 'var(--brick)' }}>{msg.text}</span>}
          </div>

          <details className="mt-5 card-soft p-4" open={!cfg?.configured}>
            <summary className="font-bold cursor-pointer" style={{ color: 'var(--ink)' }}>
              {t('📘 {name} ni sozlash — qadamlar', { name: p.label })}
            </summary>
            <ol className="list-decimal pl-5 mt-3 space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
              {p.steps.map((s, i) => (
                <li key={i}>{t(s)}</li>
              ))}
            </ol>
            <a href={p.link} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-bold underline" style={{ color: 'var(--pine)' }}>
              {t('API kalit olish sahifasi →')}
            </a>
            <p className="text-xs muted mt-3 leading-relaxed">
              {t("Eslatma: yuboruvchi sifatida oddiy @gmail.com manzilidan foydalansangiz, ba'zi xatlar Spam papkasiga tushishi mumkin. Eng yaxshi natija uchun o'z domeningizdagi manzildan foydalaning.")}
            </p>
          </details>
        </form>
      ) : (
        <div className="card p-5 text-sm muted">{t('Email xizmati sozlamalarini faqat super admin boshqaradi.')}</div>
      )}

      {isSuper && (
        <div className="card p-5">
          <div className="font-bold mb-3" style={{ color: 'var(--ink)' }}>
            {t('🧪 Test xat yuborish')}
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="email" className="input flex-1 min-w-[220px]" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={t("o'zingizning emailingiz")} />
            <button type="button" className="btn btn-soft" onClick={test} disabled={testing || !testTo.trim() || !cfg?.configured}>
              {testing ? <><span className="spinner" /> {t('Yuborilmoqda…')}</> : t('Test xat yuborish')}
            </button>
          </div>
          {!cfg?.configured && <div className="help">{t('Avval yuqoridagi sozlamalarni saqlang.')}</div>}
          {testRes && (
            <div className={`alert mt-3 text-sm ${testRes.ok ? 'alert-success' : 'alert-error'}`}>
              {testRes.ok ? t('✅ Xat yuborildi ({ms} ms). Pochtangizni (va Spam papkasini) tekshiring.', { ms: testRes.latencyMs }) : `❌ ${testRes.error}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
