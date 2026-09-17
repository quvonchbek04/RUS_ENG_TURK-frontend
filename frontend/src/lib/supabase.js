import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/** .env to'g'ri to'ldirilganmi — main.jsx shu qiymatga qarab, oq ekran o'rniga
 *  tushunarli sozlash yo'riqnomasini ko'rsatadi. */
export const supabaseConfigError = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "frontend/.env faylida VITE_SUPABASE_URL yoki VITE_SUPABASE_ANON_KEY to'ldirilmagan.";
  }
  if (SUPABASE_URL.includes('xxxxxxxxxxxx')) {
    return "frontend/.env faylidagi VITE_SUPABASE_URL hali namunaviy qiymatda qolgan — uni o'z loyihangiz manzili bilan almashtiring.";
  }
  if (!/^https?:\/\//i.test(SUPABASE_URL)) {
    return "VITE_SUPABASE_URL to'liq manzil bo'lishi kerak, masalan: https://abcdefgh.supabase.co";
  }
  return null;
})();

/** sessionStorage brauzerdan tashqarida (yoki qat'iy maxfiylik rejimida)
 *  mavjud bo'lmasligi mumkin — bunday holatda ilova qulab tushmasligi uchun
 *  xotiradagi oddiy zaxira saqlagichga o'tamiz. */
function safeStorage() {
  try {
    const probe = '__til_sayohati_test__';
    window.sessionStorage.setItem(probe, '1');
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}

// MUHIM: sozlama xato bo'lsa ham createClient chaqiriladi, lekin o'rniga
// xavfsiz "placeholder" qiymatlar beriladi. Avval bu yerda createClient
// to'g'ridan-to'g'ri undefined bilan chaqirilar va "supabaseUrl is required"
// deb modul yuklanishida qulardi — natijada foydalanuvchi sababni bilmagan
// holda butunlay bo'sh oq ekran ko'rardi.
export const supabase = createClient(
  supabaseConfigError ? 'http://localhost:54321' : SUPABASE_URL,
  supabaseConfigError ? 'public-anon-key-placeholder' : SUPABASE_ANON_KEY,
  {
    auth: {
      // Sessiya ataylab sessionStorage'da saqlanadi (localStorage emas) — shunda
      // brauzer varag'i yopilib qayta ochilganda foydalanuvchi qayta kiradi.
      storage: safeStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

/** Login uchun ishlatiladigan "sun'iy" email — Supabase Auth email talab qilgani
 *  uchun, lekin ilova login/parol asosida ishlagani uchun shunday hal qilindi.
 *  MUHIM: bu funksiya api.js da HAM ishlatiladi — avval u yerda email formulasi
 *  ikki marta qo'lda takrorlangan edi va bittasi o'zgarsa kirish buzilar edi. */
export function usernameToEmail(username) {
  return `${String(username || '').trim().toLowerCase()}@til-sayohati.app`;
}
