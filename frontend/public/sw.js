// Til sayohati — service worker.
// Maqsad: ilova telefonga o'rnatilganda tez ochilsin va internet uzilganda ham ilova qobig'i hamda darslar kontenti ko'rinsin.
// Xavfsizlik: faqat o'z saytimiz (same-origin) va shriftlar keshlanadi. Supabase (kirish, baza, fayllar), POST so'rovlar va
// audio/video (Range) so'rovlariga TEGILMAYDI. Yangi versiya chiqqanda VERSION ni oshiring — eski keshlar o'chadi.
const VERSION = 'v1';
const SHELL = `til-shell-${VERSION}`;
const ASSETS = `til-assets-${VERSION}`;
const CONTENT = `til-content-${VERSION}`;
const FONTS = `til-fonts-${VERSION}`;
const KEEP = [SHELL, ASSETS, CONTENT, FONTS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/icon.svg']))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isHtml = (res) => /text\/html/i.test(res.headers.get('content-type') || '');

async function networkFirstNavigation(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(SHELL);
      cache.put('/', res.clone()); // SPA: barcha sahifalar bitta index.html
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL);
    return (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Yo'q fayl uchun Netlify index.html (HTML) qaytaradi — uni JS/CSS sifatida saqlamaymiz
  if (res.ok && !isHtml(res)) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok && !isHtml(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(FONTS, request));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase va boshqa tashqi manzillar
  if (request.headers.has('range')) return; // audio/video bo'laklab yuklanadi — brauzer o'zi hal qiladi
  if (url.pathname.endsWith('.apk')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(ASSETS, request));
    return;
  }
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(staleWhileRevalidate(CONTENT, request));
    return;
  }
  if (/\.(png|svg|ico|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(SHELL, request));
  }
});
