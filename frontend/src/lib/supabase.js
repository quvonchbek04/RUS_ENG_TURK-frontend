import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Ilova ishga tushmasdan oldin aniq xabar berish — sozlanmagan .env eng ko'p
  // uchraydigan xato bo'lgani uchun konsolda darhol ko'rinsin.
  // eslint-disable-next-line no-console
  console.error(
    "VITE_SUPABASE_URL yoki VITE_SUPABASE_ANON_KEY topilmadi. frontend/.env faylini " +
    "frontend/.env.example namunasi asosida to'ldiring."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Sessiya ataylab sessionStorage'da saqlanadi (localStorage emas) — shunda
    // brauzer varag'i yopilib qayta ochilganda foydalanuvchi har safar qayta
    // kirishi kerak bo'ladi (avvalgi arxitekturadagi xatti-harakat saqlanadi).
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Login uchun ishlatiladigan "sun'iy" email — Supabase Auth email talab qilgani
 *  uchun, lekin ilova login/parol asosida ishlagani uchun shunday hal qilindi. */
export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@til-sayohati.app`;
}
