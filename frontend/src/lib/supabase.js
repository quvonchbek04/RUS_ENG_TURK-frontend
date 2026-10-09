import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  // Sozlanmagan .env eng ko'p uchraydigan xato — konsolda darhol ko'rinsin.
  console.error(
    'VITE_SUPABASE_URL yoki VITE_SUPABASE_ANON_KEY topilmadi. frontend/.env faylini ' +
      '(yoki Netlify → Environment variables) .env.example namunasi asosida to\'ldiring.'
  );
}

const REMEMBER_KEY = 'til_remember';

function safeGet(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    /* xotira yopiq bo'lishi mumkin (maxfiy rejim) */
  }
}
function safeRemove(store, key) {
  try {
    store.removeItem(key);
  } catch {
    /* e'tiborsiz */
  }
}

/** "Meni eslab qol" belgilansa sessiya localStorage'da (brauzer yopilsa ham saqlanadi),
 *  aks holda sessionStorage'da (varaq yopilganda chiqib ketadi) saqlanadi. */
export function getRemember() {
  return safeGet(localStorage, REMEMBER_KEY) !== '0';
}
export function setRemember(value) {
  safeSet(localStorage, REMEMBER_KEY, value ? '1' : '0');
}

const authStorage = {
  getItem(key) {
    return getRemember() ? safeGet(localStorage, key) ?? safeGet(sessionStorage, key) : safeGet(sessionStorage, key);
  },
  setItem(key, value) {
    if (getRemember()) {
      safeSet(localStorage, key, value);
      safeRemove(sessionStorage, key);
    } else {
      safeSet(sessionStorage, key, value);
      safeRemove(localStorage, key);
    }
  },
  removeItem(key) {
    safeRemove(localStorage, key);
    safeRemove(sessionStorage, key);
  },
};

export const supabase = createClient(SUPABASE_URL || 'https://example.supabase.co', SUPABASE_ANON_KEY || 'public-anon-key', {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
