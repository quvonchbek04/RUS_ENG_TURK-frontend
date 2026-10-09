// Rus (kirill) so'zlarini o'zbek lotin harflariga yaqin o'qilishga aylantiradi —
// kirillni bilmaydigan o'quvchilar uchun talaffuz yordamchisi.
const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: "'", э: 'e', ю: 'yu', я: 'ya',
};
const VOWELS = 'аеёиоуыэюяъь';

export function hasCyrillic(text) {
  return /[Ѐ-ӿ]/.test(String(text || ''));
}

export function ruTranslit(text) {
  const s = String(text || '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const lower = ch.toLowerCase();
    let t = MAP[lower];
    if (t === undefined) {
      out += ch;
      continue;
    }
    // "е" so'z boshida yoki unlidan keyin "ye" deb o'qiladi
    if (lower === 'е') {
      const prev = s[i - 1] ? s[i - 1].toLowerCase() : '';
      if (!prev || !/[Ѐ-ӿ]/.test(prev) || VOWELS.includes(prev)) t = 'ye';
    }
    if (ch !== lower && t) t = t[0].toUpperCase() + t.slice(1);
    out += t;
  }
  return out;
}

/** Til uchun o'qilish yordamchisi (faqat rus tili uchun kerak). */
export function readingHint(text, lang) {
  return lang === 'ru' && hasCyrillic(text) ? ruTranslit(text) : '';
}
