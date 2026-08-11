/**
 * Yuklangan matndan lug'at qatorlarini ajratib oladi.
 * Har xil real hayotdagi formatlarni qo'llab-quvvatlaydi, masalan:
 *   so'z ; talaffuz ; tarjima
 *   so'z - talaffuz - tarjima
 *   so'z — tarjima
 *   so'z: tarjima
 *   so'z | talaffuz | tarjima
 *   so'z <TAB> tarjima
 *   so'z    tarjima     (bir nechta probel — jadval ko'chirilganda)
 * Ustunlar soni: 2 (so'z + tarjima) yoki 3+ (so'z + talaffuz + tarjima) bo'lishi mumkin.
 */

// Har bir qatorni ajratish uchun sinab ko'riladigan ajratuvchilar, ustuvorlik tartibida.
const DELIMITERS = [
  /\s*;\s*/,       // so'z ; talaffuz ; tarjima
  /\t+/,           // Tab bilan ajratilgan (jadval/Excel'dan ko'chirilgan)
  /\s*\|\s*/,      // so'z | talaffuz | tarjima
  /\s+—\s+/,       // uzun tire (em dash)
  /\s+-\s+/,       // oddiy tire, lekin faqat probel bilan o'ralgan holda (so'z ichidagi "-" ni buzmasligi uchun)
  /\s*:\s+/,       // so'z: tarjima
  /,\s+/,          // so'z, tarjima
  /\s{2,}/,        // ikki yoki undan ko'p probel (jadval ustunlari)
];

function splitLine(line) {
  for (const delim of DELIMITERS) {
    const parts = line.split(delim).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  return [line];
}

function looksLikeHeader(parts) {
  const joined = parts.join(' ').toLowerCase();
  return /^(so'z|soz|word|слово|kelime|talaffuz|tarjima|meaning|перевод|anlam)$/i.test(parts[0] || '') ||
    (parts.length <= 2 && /so'z.*tarjima|word.*meaning/.test(joined));
}

export function parseVocabText(raw) {
  const items = [];
  let skipped = 0;

  String(raw || '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const t = rawLine.trim().replace(/^["'’]+|["'’]+$/g, '');
      if (!t) return;

      // Raqamlash belgilarini olib tashlash: "1. so'z ..." yoki "1) so'z ..."
      const cleaned = t.replace(/^\d+[.)]\s*/, '');

      const parts = splitLine(cleaned);

      if (parts.length === 1) {
        skipped += 1;
        return;
      }
      if (looksLikeHeader(parts)) {
        return; // sarlavha qatori — na qo'shiladi, na "skipped" sifatida sanaladi
      }

      if (parts.length >= 3) {
        items.push([parts[0], parts[1], parts.slice(2).join(', ')]);
      } else {
        // faqat 2 ustun: so'z + tarjima (talaffuz ustuni so'zning o'zi bilan bir xil qilib qo'yiladi)
        items.push([parts[0], parts[0], parts[1]]);
      }
    });

  return { items, skipped };
}
