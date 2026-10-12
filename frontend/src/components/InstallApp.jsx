import { useEffect, useState } from 'react';
import { Modal } from './ui.jsx';
import { APK_URL, checkApk, startInstall, useInstallState } from '../lib/install.js';
import { t } from '../i18n/index.js';

/** "Yuklab olish" bosilganda brauzerning o'z oynasi chiqmasa (masalan iPhone), shu oyna qadamlarni ko'rsatadi.
 *  Ilovada bir marta (App.jsx'da) joylanadi va `til-install-help` hodisasini tinglaydi. */
export function InstallModal() {
  const [open, setOpen] = useState(false);
  const { platform, inApp, installed } = useInstallState();
  const [apk, setApk] = useState(false);

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('til-install-help', on);
    return () => window.removeEventListener('til-install-help', on);
  }, []);

  useEffect(() => {
    if (open && platform !== 'ios') checkApk().then(setApk);
  }, [open, platform]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t('📲 Ilovani telefonga yuklab olish')}>
      {installed ? (
        <div className="alert alert-success text-sm">{t("✅ Ilova o'rnatilgan — siz hozir ilova ichidasiz.")}</div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm muted leading-relaxed">{t("Til sayohati ilova sifatida o'rnatiladi: bosh ekranda o'z belgisi bo'ladi, to'liq ekranda ochiladi va tezroq yuklanadi.")}</p>

          {inApp && (
            <div className="alert alert-warn text-sm">
              {platform === 'ios'
                ? t("Siz hozir boshqa ilova ichidagi brauzerdasiz. Saytning havolasini nusxalab, Safari brauzerida oching, keyin shu tugmani qayta bosing.")
                : t("Siz hozir boshqa ilova (Telegram, Instagram…) ichidagi brauzerdasiz. Saytning havolasini nusxalab, Chrome brauzerida oching, keyin shu tugmani qayta bosing.")}
            </div>
          )}

          {platform === 'ios' && (
            <ol className="list-decimal pl-5 space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
              <li>{t('Saytni Safari brauzerida oching.')}</li>
              <li>{t("Pastdagi «Ulashish» (⬆️) tugmasini bosing.")}</li>
              <li>{t("«Bosh ekranga qo'shish» ni tanlab, «Qo'shish» ni bosing.")}</li>
            </ol>
          )}
          {platform === 'android' && (
            <ol className="list-decimal pl-5 space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
              <li>{t("Sayt Chrome brauzerida ochiq bo'lsin (Telegram yoki Instagram ichidagi brauzerda emas).")}</li>
              <li>{t('Yuqori o\'ng burchakdagi ⋮ menyusini bosing.')}</li>
              <li>{t("«Ilovani o'rnatish» (yoki «Bosh ekranga qo'shish») ni tanlab, tasdiqlang.")}</li>
            </ol>
          )}
          {platform === 'other' && <p className="text-sm" style={{ color: 'var(--ink)' }}>{t("Kompyuterda: manzil satrining o'ng tomonidagi o'rnatish belgisini (⊕) bosing yoki brauzer menyusidan «Ilovani o'rnatish» ni tanlang.")}</p>}

          {apk && platform !== 'ios' && (
            <a href={APK_URL} download className="btn btn-gold btn-block">
              {t('📥 APK faylni yuklab olish (Android)')}
            </a>
          )}
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpen(false)}>
            {t('Yopish')}
          </button>
        </div>
      )}
    </Modal>
  );
}

/** Profil sahifasidagi "Ilova" kartasi. */
export function InstallCard() {
  const { installed } = useInstallState();
  return (
    <div className="card p-5">
      <div className="h2 mb-1">{t('📲 Ilovani yuklab olish')}</div>
      {installed ? (
        <div className="alert alert-success text-sm mt-3">{t("✅ Ilova o'rnatilgan — siz hozir ilova ichidasiz.")}</div>
      ) : (
        <>
          <p className="text-sm muted mb-4">{t("Telefoningizga ilova sifatida o'rnating: bosh ekranda belgisi, to'liq ekran va tezroq ochilish.")}</p>
          <button type="button" className="btn btn-gold btn-block" onClick={startInstall}>
            {t('📲 Yuklab olish')}
          </button>
        </>
      )}
    </div>
  );
}

/** Bosh sahifadagi qisqa taklif (faqat telefonda, ilova o'rnatilmagan bo'lsa; ✕ bilan yopiladi). */
export function InstallBanner() {
  const { installed } = useInstallState();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('til_install_banner_hidden') === '1';
    } catch {
      return false;
    }
  });
  if (installed || hidden) return null;
  return (
    <div className="lg:hidden card p-3.5 mb-5 flex items-center gap-3">
      <span className="text-2xl">📲</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
          {t('Ilovani telefoningizga yuklab oling')}
        </div>
        <div className="text-xs muted">{t("Bosh ekranda belgi, to'liq ekran, tezroq ochilish")}</div>
      </div>
      <button type="button" className="btn btn-gold btn-sm" onClick={startInstall}>
        {t('Yuklab olish')}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-icon !w-8 !h-8 !min-h-8"
        aria-label={t('Yopish')}
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem('til_install_banner_hidden', '1');
          } catch {
            /* e'tiborsiz */
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}

/** Kirish / ro'yxatdan o'tish sahifalari pastida kichik havola. */
export function InstallLink() {
  const { installed } = useInstallState();
  if (installed) return null;
  return (
    <button type="button" onClick={startInstall} className="mt-5 text-sm font-bold underline" style={{ color: 'var(--pine)' }}>
      {t('📲 Ilovani yuklab olish')}
    </button>
  );
}
