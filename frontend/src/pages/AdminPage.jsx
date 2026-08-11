import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABEL = {
  superadmin: 'Super admin',
  admin: 'Admin',
  user: "O'quvchi",
};

export default function AdminPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', displayName: '' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiForm, setAiForm] = useState({ geminiApiKey: '', provider: 'mock' });
  const [savingAi, setSavingAi] = useState(false);
  const [aiFormMsg, setAiFormMsg] = useState(null);
  const [stats, setStats] = useState(null);

  function refresh() {
    api.listAdminUsers().then((r) => setUsers(r.users)).catch((e) => setError(e.message));
  }

  useEffect(refresh, []);
  useEffect(() => {
    api.getAdminStats().then(setStats).catch(() => {});
  }, []);
  useEffect(() => {
    api.aiStatus().then((s) => {
      setAiStatus(s);
      setAiForm((f) => ({ ...f, provider: s.configuredProvider === 'gemini' ? 'gemini' : 'mock' }));
    }).catch(() => {});
  }, []);

  async function onSaveAiSettings(e) {
    e.preventDefault();
    setSavingAi(true);
    setAiFormMsg(null);
    try {
      const s = await api.saveAiSettings(aiForm);
      setAiStatus(s);
      setAiForm((f) => ({ ...f, geminiApiKey: '' }));
      setAiFormMsg({
        ok: true,
        text: s.provider === 'gemini' ? '✅ Saqlandi — Gemini AI endi faol.' : "✅ Saqlandi (hozircha mock rejimida, kalit yo'q yoki provayder mock qilib qo'yildi).",
      });
    } catch (err) {
      setAiFormMsg({ ok: false, text: err.message });
    } finally {
      setSavingAi(false);
    }
  }

  if (user && user.role !== 'admin' && user.role !== 'superadmin') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-5 py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="font-display text-2xl font-semibold mb-2" style={{ color: 'var(--ink)' }}>
            Ruxsat yo'q
          </h1>
          <p style={{ color: 'var(--ink-soft)' }}>
            Bu sahifa faqat administratorlar uchun.
          </p>
          <Link to="/" className="inline-block mt-6 font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--pine)' }}>
            ← Panelga qaytish
          </Link>
        </div>
      </Layout>
    );
  }

  async function onCreateAdmin(e) {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      const { user: created } = await api.createAdmin(form);
      setUsers((prev) => [...(prev || []), created]);
      setForm({ username: '', password: '', displayName: '' });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(u) {
    if (!confirm(`"${u.username}" adminlikdan o'chirilsinmi?`)) return;
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
    try {
      await api.deleteAdmin(u.id);
    } catch (err) {
      setError(err.message);
      refresh();
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="mb-8">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Boshqaruv
          </div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
            Foydalanuvchilar
          </h1>
        </div>

        {error && (
          <div className="mb-6 text-sm px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
            {error}
          </div>
        )}

        {stats && (
          <div className="rounded-xl border p-5 mb-8" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-2xl shrink-0">📊</span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                  Kontent statistikasi
                </div>
                <div className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  Saytdagi barcha til bo'yicha ma'lumotlar soni
                </div>
              </div>
            </div>

            {/* Umumiy jami (barcha tillar bo'yicha) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {[
                ['📘', 'Darslar', stats.totals.lessons],
                ['📚', "Lug'at so'zlari", stats.totals.vocabTotal],
                ['🎧', 'Dialoglar', stats.totals.dialogsTotal],
                ['📐', 'Grammatika mavzulari', stats.totals.grammarTopics],
                ['✏️', 'Mashqlar', stats.totals.exercises],
                ['🔤', "Fe'llar", stats.totals.verbs],
                ['👤', 'Foydalanuvchilar', stats.userCount],
                ['📕', 'Kitoblar', stats.bookCount],
              ].map(([icon, label, val]) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ background: 'var(--paper-soft)' }}>
                  <div className="text-lg mb-0.5">{icon}</div>
                  <div className="font-display text-xl font-bold" style={{ color: 'var(--pine)' }}>
                    {val}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Til bo'yicha batafsil jadval */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ color: 'var(--ink-soft)' }} className="font-mono text-[10px] uppercase tracking-wide">
                    <th className="text-left py-2 pr-3">Til</th>
                    <th className="text-right py-2 px-3">Bosqich</th>
                    <th className="text-right py-2 px-3">Dars</th>
                    <th className="text-right py-2 px-3">Lug'at</th>
                    <th className="text-right py-2 px-3">Dialog</th>
                    <th className="text-right py-2 px-3">Grammatika</th>
                    <th className="text-right py-2 px-3">Mashq</th>
                    <th className="text-right py-2 pl-3">Fe'l</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.perLang).map(([code, s]) => (
                    <tr key={code} className="border-t" style={{ borderColor: 'var(--line)' }}>
                      <td className="py-2 pr-3 font-semibold" style={{ color: 'var(--ink)' }}>
                        {s.title}
                      </td>
                      <td className="text-right py-2 px-3" style={{ color: 'var(--ink)' }}>{s.stages}</td>
                      <td className="text-right py-2 px-3" style={{ color: 'var(--ink)' }}>{s.lessons}</td>
                      <td className="text-right py-2 px-3" style={{ color: 'var(--ink)' }}>
                        {s.vocabTotal}
                        <span className="font-mono text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                          {' '}({s.courseVocab}+{s.extraVocab})
                        </span>
                      </td>
                      <td className="text-right py-2 px-3" style={{ color: 'var(--ink)' }}>
                        {s.dialogsTotal}
                        <span className="font-mono text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                          {' '}({s.courseDialogs}+{s.extraDialogs})
                        </span>
                      </td>
                      <td className="text-right py-2 px-3" style={{ color: 'var(--ink)' }}>{s.grammarTopics}</td>
                      <td className="text-right py-2 px-3" style={{ color: 'var(--ink)' }}>{s.exercises}</td>
                      <td className="text-right py-2 pl-3" style={{ color: 'var(--ink)' }}>{s.verbs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[10px] mt-2" style={{ color: 'var(--ink-soft)' }}>
              Lug'at/Dialog ustunlaridagi qavs ichidagi sonlar: (dars ichidagi + qo'shimcha to'plamdagi)
            </p>
          </div>
        )}

        {aiStatus && (
          <div
            className="rounded-xl border p-5 mb-8"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <div className="flex items-center gap-4 mb-1">
              <span className="text-2xl shrink-0">🤖</span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                  AI (Gemini) sozlamalari
                </div>
                <div className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {aiStatus.provider === 'gemini'
                    ? '✅ Gemini AI faol — matn/dialog vazifalari va javob tekshiruvi haqiqiy AI orqali ishlamoqda.'
                    : "🟡 Hozircha \"mock\" rejimida ishlayapti — API kalit kiritilmagan yoki o'chirilgan."}
                </div>
              </div>
              <span
                className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-full shrink-0"
                style={{
                  background: aiStatus.provider === 'gemini' ? 'var(--success-bg)' : 'var(--gold-soft)',
                  color: aiStatus.provider === 'gemini' ? 'var(--pine)' : 'var(--gold)',
                }}
              >
                {aiStatus.provider === 'gemini' ? 'Gemini faol' : 'Mock rejim'}
              </span>
            </div>

            {isSuperAdmin ? (
              <form onSubmit={onSaveAiSettings} className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                  Gemini API kalit
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <input
                    value={aiForm.geminiApiKey}
                    onChange={(e) => setAiForm((f) => ({ ...f, geminiApiKey: e.target.value }))}
                    placeholder={aiStatus.hasKey ? '•••••••••••••••••••• (kalit saqlangan, o\'zgartirish uchun yangisini yozing)' : 'AIzaSy... kalitni shu yerga joylashtiring'}
                    type="text"
                    autoComplete="off"
                    className="flex-1 min-w-[240px] px-3 py-2.5 rounded-lg border outline-none font-mono text-xs"
                    style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  />
                  <select
                    value={aiForm.provider}
                    onChange={(e) => setAiForm((f) => ({ ...f, provider: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg border outline-none font-mono text-xs"
                    style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
                  >
                    <option value="mock">Mock (AI o'chiq)</option>
                    <option value="gemini">Gemini (AI yoqilgan)</option>
                  </select>
                  <button
                    type="submit"
                    disabled={savingAi}
                    className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold disabled:opacity-60"
                    style={{ background: 'var(--pine)', color: 'var(--paper)' }}
                  >
                    {savingAi ? 'Saqlanmoqda…' : 'Saqlash'}
                  </button>
                </div>
                {aiFormMsg && (
                  <div className="font-mono text-[11px]" style={{ color: aiFormMsg.ok ? 'var(--pine)' : 'var(--brick)' }}>
                    {aiFormMsg.text}
                  </div>
                )}
                <p className="font-mono text-[10px] mt-2" style={{ color: 'var(--ink-soft)' }}>
                  Bepul kalitni{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">
                    aistudio.google.com/apikey
                  </a>{' '}
                  saytidan olishingiz mumkin. Kalit backend bazasida saqlanadi, serverni qayta ishga tushirish shart emas.
                </p>
              </form>
            ) : (
              <p className="mt-3 pt-3 border-t font-mono text-[11px]" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                API kalitni faqat super admin o'zgartira oladi.
              </p>
            )}
          </div>
        )}

        {isSuperAdmin && (
          <form
            onSubmit={onCreateAdmin}
            className="rounded-xl border p-5 mb-8"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--ink-soft)' }}>
              Yangi admin qo'shish
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="Login"
                required
                className="px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              />
              <input
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Parol"
                type="password"
                required
                className="px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              />
              <input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Ism (ixtiyoriy)"
                className="px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
              />
            </div>
            {formError && (
              <div className="mb-3 text-sm px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
                {formError}
              </div>
            )}
            <button
              type="submit"
              disabled={creating}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold disabled:opacity-60"
              style={{ background: 'var(--pine)', color: 'var(--paper)' }}
            >
              {creating ? 'Qo\'shilmoqda…' : '+ Admin qo\'shish'}
            </button>
          </form>
        )}

        {!users && <div className="font-mono text-sm" style={{ color: 'var(--ink-soft)' }}>Yuklanmoqda…</div>}

        <div className="grid gap-2">
          {users?.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border p-4 flex items-center gap-4"
              style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
            >
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center font-mono text-sm font-semibold shrink-0"
                style={{ background: 'var(--paper-soft)', color: 'var(--ink)' }}
              >
                {(u.displayName || u.username).slice(0, 1).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {u.displayName || u.username}
                </div>
                <div className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  @{u.username} · {new Date(u.createdAt).toLocaleDateString('uz-UZ')}
                </div>
              </div>
              <span
                className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-full shrink-0"
                style={{
                  background: u.role === 'superadmin' ? 'var(--gold-soft)' : u.role === 'admin' ? 'var(--success-bg)' : 'var(--paper-soft)',
                  color: u.role === 'superadmin' ? 'var(--gold)' : u.role === 'admin' ? 'var(--pine)' : 'var(--ink-soft)',
                }}
              >
                {ROLE_LABEL[u.role] || u.role}
              </span>
              {isSuperAdmin && u.role === 'admin' && (
                <button
                  onClick={() => onDelete(u)}
                  title="Adminlikdan o'chirish"
                  className="w-8 h-8 rounded-lg cursor-pointer shrink-0 flex items-center justify-center"
                  style={{ color: 'var(--brick)' }}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
