// Login maydoniga kiritilgan qiymatni (email, telefon yoki oddiy login)
// Supabase Auth ishlatadigan email'ga aylantiradi. Telefon va login uchun
// ichki "sun'iy" email ishlatiladi: tel998901234567@til-sayohati.app,
// quvonchbek@til-sayohati.app. Bu qoidalar supabase/functions/admin bilan bir xil.

export const SYNTH_DOMAIN = 'til-sayohati.app';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Telefonni faqat raqamlarga keltiradi; 9 xonali O'zbekiston raqamiga 998 qo'shadi. */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function formatPhone(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.startsWith('998') && d.length === 12) {
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)}-${d.slice(8, 10)}-${d.slice(10)}`;
  }
  return d ? '+' + d : '';
}

export function isValidEmail(s) {
  return EMAIL_RE.test(String(s || '').trim());
}

/** @returns {{kind:'email'|'phone'|'username', email:string, username:string, phone:string|null}|null} */
export function resolveIdentifier(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (s.includes('@')) {
    if (!isValidEmail(s)) return null;
    return { kind: 'email', email: s.toLowerCase(), username: s.split('@')[0], phone: null };
  }
  if (/^\+?[\d\s\-()]{9,}$/.test(s)) {
    const d = normalizePhone(s);
    if (!d) return null;
    return { kind: 'phone', email: `tel${d}@${SYNTH_DOMAIN}`, username: d, phone: '+' + d };
  }
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(s)) return null;
  return { kind: 'username', email: `${s.toLowerCase()}@${SYNTH_DOMAIN}`, username: s, phone: null };
}

export function isSyntheticEmail(email) {
  return String(email || '').toLowerCase().endsWith('@' + SYNTH_DOMAIN);
}
