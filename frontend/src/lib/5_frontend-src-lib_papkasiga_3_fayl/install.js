// "Ilovani yuklab olish": brauzerning o'rnatish so'rovi (PWA).
// Android Chrome'da bu haqiqiy ilova (WebAPK) sifatida o'rnatadi: bosh ekranda belgi, to'liq ekran, ilovalar ro'yxatida ko'rinadi.
// iPhone'da Safari o'rnatish tugmasini bermaydi — foydalanuvchiga "Bosh ekranga qo'shish" ko'rsatmasi chiqariladi.
import { useSyncExternalStore } from 'react';

let deferred = null; // beforeinstallprompt hodisasi
let installedFlag = false;
let version = 0;
const listeners = new Set();
const notify = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

/** Ilova ochilishi bilan bir marta chaqiriladi: hodisa React yuklanishidan oldin kelib qolishi mumkin. */
export function captureInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // brauzerning o'z paneli o'rniga o'z tugmamizdan foydalanamiz
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedFlag = true;
    notify();
  });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

/** 'ios' | 'android' | 'other' */
export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iP(hone|ad|od)/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** Telegram, Instagram, Facebook kabi ilovalar ichidagi brauzer (WebView) o'rnatishni qo'llab-quvvatlamaydi. */
export function inAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|Telegram/i.test(ua)) return true;
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return true; // Android WebView
  if (detectPlatform() === 'ios' && !/Safari\//.test(ua)) return true; // iOS WebView
  return false;
}

export function canPrompt() {
  return !!deferred;
}

/** Brauzerning o'rnatish oynasini ochadi. Qaytaradi: 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    notify();
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    notify();
    return 'unavailable';
  }
}

/** "Yuklab olish" tugmasi bosilganda: imkon bo'lsa — brauzerning o'z oynasi, bo'lmasa — qadamlar ko'rsatilgan oyna (InstallModal). */
export async function startInstall() {
  if (canPrompt()) {
    const res = await promptInstall();
    if (res !== 'unavailable') return;
  }
  window.dispatchEvent(new Event('til-install-help'));
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** { installed, canPrompt, platform, inApp } — o'zgarganda komponent qayta chiziladi. */
export function useInstallState() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return {
    installed: installedFlag || isStandalone(),
    canPrompt: canPrompt(),
    platform: detectPlatform(),
    inApp: inAppBrowser(),
  };
}

// ---------------------------------------------------------------------------
// APK fayl (ixtiyoriy): agar saytga /til-sayohati.apk joylangan bo'lsa, yuklab olish havolasi ko'rsatiladi
// ---------------------------------------------------------------------------
export const APK_URL = '/til-sayohati.apk';
let apkPromise = null;

export function checkApk() {
  if (!apkPromise) {
    apkPromise = fetch(APK_URL, { method: 'HEAD', cache: 'no-store' })
      .then((r) => r.ok && !/text\/html/i.test(r.headers.get('content-type') || '')) // SPA yo'naltirishi HTML qaytaradi — bu fayl emas
      .catch(() => false);
  }
  return apkPromise;
}
