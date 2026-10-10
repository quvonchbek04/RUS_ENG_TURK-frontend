import { useState } from 'react';
import { MEDIA_META, MEDIA_ORDER, canUploadKind } from '../lib/media.js';
import { FUNC_PERM_KEYS, can, funcPerms, superOnlyPowers } from '../lib/roles.js';
import { t } from '../i18n/index.js';

function Mark({ on }) {
  return (
    <span
      className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold shrink-0"
      style={on ? { background: 'var(--pine)', color: '#fff' } : { background: 'var(--paper-soft)', color: 'var(--ink-faint)' }}
      aria-label={on ? t('Ruxsat bor') : t("Ruxsat yo'q")}
    >
      {on ? '✓' : '✕'}
    </span>
  );
}

/** Profil → "🔐 Mening ruxsatlarim": admin nimalarga ruxsati borligini (va nimalarga yo'qligini) bir joyda ko'radi.
 *  Super admin uchun — hamma narsaga ruxsat borligi qisqacha ko'rsatiladi. onRefresh — ruxsatlarni serverdan qayta yuklaydi. */
export default function MyPermissions({ user, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const isSuper = user.role === 'superadmin';
  const perms = funcPerms();
  const kindsOn = MEDIA_ORDER.filter((k) => canUploadKind(user, k));
  const funcsOn = FUNC_PERM_KEYS.filter((k) => can(user, k));

  async function refresh() {
    setBusy(true);
    try {
      await onRefresh?.();
    } catch {
      /* e'tiborsiz — eski ma'lumot ko'rinib turadi */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="perms" className="card p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div className="h2 flex-1 min-w-[200px]">{t('🔐 Mening ruxsatlarim')}</div>
        {!isSuper && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={refresh} disabled={busy} title={t('Ruxsatlarni serverdan qayta yuklash')}>
            {busy ? <span className="spinner" /> : '↻'} {t('Yangilash')}
          </button>
        )}
      </div>

      {isSuper ? (
        <>
          <p className="text-sm muted mb-3">{t("Siz super adminsiz — hamma bo'limga va hamma funksiyaga ruxsatingiz bor. Adminlarning ruxsatlarini «🔐 Ruxsatlar» bo'limida belgilaysiz.")}</p>
          <div className="flex flex-wrap gap-2">
            {MEDIA_ORDER.map((k) => (
              <span key={k} className="chip chip-active">
                ✓ {MEDIA_META[k].icon} {MEDIA_META[k].short}
              </span>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {perms.map((p) => (
              <div key={p.key} className="card-soft p-2.5 flex items-center gap-2.5">
                <span className="text-lg leading-none">{p.icon}</span>
                <span className="flex-1 min-w-0 font-bold text-[13px]" style={{ color: 'var(--ink)' }}>
                  {p.label}
                </span>
                <Mark on />
              </div>
            ))}
          </div>
          <p className="text-xs muted mt-3 leading-relaxed">{t("Sizning ma'lumotlaringiz (login, email, telefon) boshqa hech kimga — adminlarga ham — ko'rinmaydi.")}</p>
        </>
      ) : (
        <>
          <p className="text-sm muted mb-4">{t("Super admin sizga quyidagi ruxsatlarni bergan. Yangi ruxsat kerak bo'lsa, super admin bilan bog'laning.")}</p>

          {/* Material yuklash */}
          <div className="flex items-center gap-2 mb-2">
            <div className="font-bold text-sm flex-1" style={{ color: 'var(--ink)' }}>
              {t('📤 Material yuklash')}
            </div>
            <span className={`badge ${kindsOn.length ? 'badge-pine' : 'badge-brick'}`}>{t("{a}/{b} bo'lim", { a: kindsOn.length, b: MEDIA_ORDER.length })}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {MEDIA_ORDER.map((k) => {
              const on = kindsOn.includes(k);
              return (
                <span key={k} className={`chip ${on ? 'chip-active' : ''}`} style={on ? undefined : { opacity: 0.6 }}>
                  {on ? '✓' : '✕'} {MEDIA_META[k].icon} {MEDIA_META[k].short}
                </span>
              );
            })}
          </div>

          {/* Funksiyalar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="font-bold text-sm flex-1" style={{ color: 'var(--ink)' }}>
              {t('⚙️ Funksiyalar')}
            </div>
            <span className={`badge ${funcsOn.length ? 'badge-pine' : 'badge-brick'}`}>{t('{a}/{b} funksiya', { a: funcsOn.length, b: FUNC_PERM_KEYS.length })}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 mb-5">
            {perms.map((p) => {
              const on = can(user, p.key);
              return (
                <div key={p.key} className="card-soft p-2.5 flex items-start gap-2.5" style={on ? { borderColor: 'var(--pine)' } : { opacity: 0.7 }}>
                  <span className="text-lg leading-none mt-0.5">{p.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-[13px]" style={{ color: 'var(--ink)' }}>
                      {p.label}
                    </span>
                    <span className="block text-[11.5px] muted leading-snug">{p.desc}</span>
                  </span>
                  <Mark on={on} />
                </div>
              );
            })}
          </div>

          {/* Faqat super admin */}
          <details className="card-soft p-3.5">
            <summary className="font-bold cursor-pointer text-sm" style={{ color: 'var(--ink)' }}>
              {t('🔒 Faqat super admin uchun (sizda yo\'q)')}
            </summary>
            <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
              {superOnlyPowers().map((p) => (
                <li key={p.label} className="flex items-start gap-2">
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
