import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { formatPhone } from '../../lib/identity.js';
import { MEDIA_META, MEDIA_ORDER } from '../../lib/media.js';
import { FUNC_PERM_KEYS, funcPerms, superOnlyPowers } from '../../lib/roles.js';
import { t } from '../../i18n/index.js';
import { Rich } from '../../i18n/react.jsx';

const GROUPS = [
  ['users', "👥 O'quvchilar bilan ishlash"],
  ['view', "👁️ Ko'rish"],
];

/** Admin panel → "🔐 Ruxsatlar": har bir admin nimalarga ruxsati borligini super admin shu yerda belgilaydi —
 *  material yuklash (tur bo'yicha) va funksiyalar (o'quvchilar, AI, email, statistika). O'zgarish darhol kuchga kiradi. */
export default function PermissionsPanel() {
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState({}); // adminId -> 'saving' | 'saved'
  const queues = useRef({}); // adminId -> so'rovlar zanjiri (ketma-ket yuboriladi, tartib buzilmasligi uchun)
  const pending = useRef({});

  const load = useCallback(() => {
    api
      .listAdminUsers()
      .then((r) => {
        setAdmins((r.users || []).filter((u) => u.role === 'admin').sort((a, b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username), 'uz')));
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  /** local — ekranda darhol ko'rinadigan o'zgarish; patch — serverga yuboriladigan qism ({ uploadKinds } yoki { permissions }). */
  function save(admin, local, patch) {
    const id = admin.id;
    setAdmins((prev) => prev.map((a) => (a.id === id ? { ...a, ...local } : a)));
    setError('');
    pending.current[id] = (pending.current[id] || 0) + 1;
    setStatus((s) => ({ ...s, [id]: 'saving' }));
    queues.current[id] = (queues.current[id] || Promise.resolve())
      .then(() => api.setPermissions(id, patch))
      .catch((e) => {
        setError(e.message);
        load(); // xato bo'lsa — serverdagi haqiqiy holatni qayta yuklaymiz
      })
      .finally(() => {
        pending.current[id] -= 1;
        if (pending.current[id] <= 0) setStatus((s) => ({ ...s, [id]: 'saved' }));
      });
  }

  const setKinds = (admin, next) => save(admin, { uploadKinds: next }, { uploadKinds: next });
  const setFuncs = (admin, next) => save(admin, { permissions: next }, { permissions: next });

  function toggleKind(admin, kind) {
    const current = admin.uploadKinds || [];
    setKinds(admin, current.includes(kind) ? current.filter((k) => k !== kind) : MEDIA_ORDER.filter((k) => current.includes(k) || k === kind));
  }

  function toggleFunc(admin, key) {
    const current = admin.permissions || [];
    setFuncs(admin, current.includes(key) ? current.filter((k) => k !== key) : FUNC_PERM_KEYS.filter((k) => current.includes(k) || k === key));
  }

  const perms = funcPerms();

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <div className="h2">{t('🔐 Adminlarning ruxsatlari')}</div>
        <p className="text-sm muted mt-1">
          <Rich
            text={t(
              "Har bir admin nimalarga ruxsati borligini shu yerda belgilaysiz: **material yuklash** (bo'limlar bo'yicha) va **funksiyalar** (o'quvchilarni ko'rish va boshqarish, AI, email, statistika). Belgilanmagan narsani admin ko'ra olmaydi yoki bajara olmaydi. Siz — super admin — hammasiga egasiz."
            )}
          />
        </p>
        <p className="text-xs faint mt-1">{t("Ruxsat serverda va bazada darhol kuchga kiradi; adminning ekranidagi bo'limlar sahifa yangilanganda yangilanadi. Admin o'z ruxsatlarini profilidagi «🔐 Mening ruxsatlarim» bo'limida ko'radi.")}</p>
      </div>

      <details className="card-soft p-4 mb-4">
        <summary className="font-bold cursor-pointer text-sm" style={{ color: 'var(--ink)' }}>
          {t("🔒 Faqat super admin uchun — hech kimga berilmaydi")}
        </summary>
        <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
          {superOnlyPowers().map((p) => (
            <li key={p.label} className="flex items-start gap-2">
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs muted mt-3">{t("Admin o'quvchilarni faqat siz ruxsat bergan darajada ko'radi va boshqaradi; super admin hamda boshqa adminlar ro'yxatda ko'rinmaydi.")}</p>
      </details>

      {error && <div className="alert alert-error mb-4 text-sm">{error}</div>}
      {!admins && !error && (
        <div className="space-y-3">
          <div className="skeleton h-28" />
          <div className="skeleton h-28" />
        </div>
      )}

      {admins && admins.length === 0 && (
        <EmptyState
          icon="🔐"
          title={t("Hozircha adminlar yo'q")}
          text={t("Avval Foydalanuvchilar bo'limida admin qo'shing yoki o'quvchini admin qiling — keyin ruxsatlarini shu yerda belgilaysiz.")}
          action={
            <Link to="/admin?tab=users" className="btn btn-gold">
              {t("👥 Foydalanuvchilarga o'tish")}
            </Link>
          }
        />
      )}

      <div className="space-y-4">
        {(admins || []).map((a) => {
          const kinds = a.uploadKinds || [];
          const funcs = a.permissions || [];
          const st = status[a.id];
          return (
            <div key={a.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: 'var(--paper-soft)', color: 'var(--ink)' }}>
                  {(a.displayName || a.username || '?').slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-[160px]">
                  <div className="font-bold truncate" style={{ color: 'var(--ink)' }}>
                    {a.displayName || a.username}
                  </div>
                  <div className="text-xs muted truncate">{a.email || (a.phone ? formatPhone(a.phone) : `@${a.username}`)}</div>
                </div>
                <span className={`badge ${kinds.length ? 'badge-pine' : 'badge-brick'}`}>{t("{a}/{b} bo'lim", { a: kinds.length, b: MEDIA_ORDER.length })}</span>
                <span className={`badge ${funcs.length ? 'badge-pine' : 'badge-brick'}`}>{t('{a}/{b} funksiya', { a: funcs.length, b: FUNC_PERM_KEYS.length })}</span>
              </div>

              {/* Material yuklash */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="font-bold text-sm flex-1 min-w-[160px]" style={{ color: 'var(--ink)' }}>
                  {t('📤 Material yuklash')}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKinds(a, [...MEDIA_ORDER])} disabled={kinds.length === MEDIA_ORDER.length}>
                    {t('Hammasi')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKinds(a, [])} disabled={kinds.length === 0}>
                    {t('Hech biri')}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {MEDIA_ORDER.map((k) => {
                  const on = kinds.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleKind(a, k)}
                      className={`chip ${on ? 'chip-active' : ''}`}
                      title={on ? t('{name}: ruxsat berilgan — bosib olib tashlang', { name: MEDIA_META[k].label }) : t("{name}: ruxsat yo'q — bosib ruxsat bering", { name: MEDIA_META[k].label })}
                    >
                      {on ? '✓' : '🔒'} {MEDIA_META[k].icon} {MEDIA_META[k].short}
                    </button>
                  );
                })}
              </div>

              {/* Funksiyalar */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="font-bold text-sm flex-1 min-w-[160px]" style={{ color: 'var(--ink)' }}>
                  {t('⚙️ Funksiyalar')}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFuncs(a, [...FUNC_PERM_KEYS])} disabled={funcs.length === FUNC_PERM_KEYS.length}>
                    {t('Hammasi')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFuncs(a, [])} disabled={funcs.length === 0}>
                    {t('Hech biri')}
                  </button>
                </div>
              </div>
              {GROUPS.map(([g, label]) => (
                <div key={g} className="mb-3 last:mb-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider faint mb-1.5">{t(label)}</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {perms
                      .filter((p) => p.group === g)
                      .map((p) => {
                        const on = funcs.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleFunc(a, p.key)}
                            className="card-soft p-2.5 text-left flex items-start gap-2.5 transition-colors"
                            style={on ? { borderColor: 'var(--pine)', background: 'var(--pine-soft)' } : undefined}
                          >
                            <span className="text-lg leading-none mt-0.5">{p.icon}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-bold text-[13px]" style={{ color: 'var(--ink)' }}>
                                {p.label}
                              </span>
                              <span className="block text-[11.5px] muted leading-snug">{p.desc}</span>
                            </span>
                            <span className="font-bold text-sm" style={{ color: on ? 'var(--pine)' : 'var(--ink-faint)' }}>
                              {on ? '✓' : '🔒'}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}

              <div className="text-xs faint mt-3 h-4">{st === 'saving' ? t('Saqlanmoqda…') : st === 'saved' ? t('✓ Saqlandi') : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
