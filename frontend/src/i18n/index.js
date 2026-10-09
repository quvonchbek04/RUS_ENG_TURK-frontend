// ============================================================================
// Interfeys tili (o'zbek / rus / ingliz / turk).
//
// Qoida: kalit — o'zbekcha matnning o'zi:  t("Parolni unutdingizmi?")
// Tarjimalar src/i18n/dict/*.js fayllarida qatorlar ko'rinishida: [uz, ru, en, tr].
//   • Tarjimasi topilmasa — o'zbekcha matn ko'rsatiladi (ilova hech qachon buzilmaydi).
//   • O'zgaruvchilar:  t("Jami {n} ta", { n: 5 })  — kalitda {n}, tarjimalarda ham {n}.
//   • Serverdan kelgan xabarlar (o'zbekcha) ham t(xabar) orqali tarjima qilinadi;
//     {n} li kalitlar shablon sifatida moslashtiriladi.
// Til almashganda ilovaning sahifalar qismi qayta chiziladi (src/i18n/react.jsx).
// ============================================================================
import rows from './dict/index.js';

export const UI_LANGS = [
  { key: 'uz', label: "O'zbekcha", flag: '🇺🇿', locale: 'uz-UZ' },
  { key: 'ru', label: 'Русский', flag: '🇷🇺', locale: 'ru-RU' },
  { key: 'en', label: 'English', flag: '🇬🇧', locale: 'en-GB' },
  { key: 'tr', label: 'Türkçe', flag: '🇹🇷', locale: 'tr-TR' },
];

const STORAGE_KEY = 'til_ui_lang';
const COLUMN = { ru: 1, en: 2, tr: 3 };

function readSaved() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (UI_LANGS.some((l) => l.key === s)) return s;
  } catch {
    /* xotira yopiq bo'lishi mumkin */
  }
  return 'uz';
}

let current = readSaved();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function getLang() {
  return current;
}

export function getLocale() {
  return UI_LANGS.find((l) => l.key === current)?.locale || 'uz-UZ';
}

export function setLang(key) {
  if (!UI_LANGS.some((l) => l.key === key)) return;
  current = key;
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* e'tiborsiz */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = key;
}

let exact = null; // o'zbekcha matn -> qator
let patterns = null; // {n} li kalitlar uchun shablonlar

function build() {
  exact = new Map();
  patterns = [];
  for (const row of rows) {
    exact.set(row[0], row);
    if (row[0].includes('{')) {
      const names = [];
      const src = row[0]
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = part.match(/^\{(\w+)\}$/);
          if (m) {
            names.push(m[1]);
            return '([\\s\\S]+?)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
      patterns.push({ re: new RegExp(`^${src}$`), names, row });
    }
  }
}

function fill(text, vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k]))) : text;
}

/** Matnni joriy interfeys tiliga o'giradi. */
export function t(key, vars) {
  if (typeof key !== 'string' || !key) return key;
  if (current !== 'uz') {
    if (!exact) build();
    const col = COLUMN[current];
    const row = exact.get(key);
    if (row && row[col]) return fill(row[col], vars);
    if (!vars) {
      // Serverdan kelgan xabar: "Kod noto'g'ri (3 ta urinish qoldi)" kabi o'zgaruvchili kalitlarga moslaymiz
      for (const p of patterns) {
        const m = key.match(p.re);
        if (m && p.row[col]) {
          const v = {};
          p.names.forEach((n, j) => {
            v[n] = t(m[j + 1]); // ichki qiymat ham (masalan, dars/mavzu nomi) bo'lsa — tarjima qilinadi
          });
          return fill(p.row[col], v);
        }
      }
      // Murakkab yorliqlar ("Dars testi: 1-oy · Alifbo va tanishuv"): bo'laklarga ajratib, har birini alohida o'giramiz
      if (/(: | · )/.test(key)) {
        const parts = key.split(/(: | · )/);
        const out = parts.map((part, i) => (i % 2 === 1 ? part : t(part)));
        if (out.some((x, i) => x !== parts[i])) return out.join('');
      }
    }
  }
  return fill(key, vars);
}
