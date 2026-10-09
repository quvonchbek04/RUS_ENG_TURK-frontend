/**
 * Matndan dialog qatorlarini ajratadi. Qo'llab-quvvatlanadigan formatlar:
 *   A: Hello! | Salom!
 *   Anna: How are you? — Qalaysiz?
 *   B: I'm fine.            (keyingi qatorda tarjima qavs ichida: (Yaxshiman.))
 *   Hello!                  (so'zlovchi ko'rsatilmasa — A/B navbatma-navbat)
 * Natija: [[so'zlovchi, gap, tarjima], ...]
 */
const SPEAKER_RE = /^([\p{L}\d .'-]{1,24}?)\s*[:：]\s+(.+)$/u;
const SPLITTERS = [/\s+\|\s+/, /\s+—\s+/, /\s+–\s+/, /\s+=\s+/];

function splitTranslation(text) {
  for (const re of SPLITTERS) {
    const parts = text.split(re);
    if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' ').trim()];
  }
  return [text.trim(), ''];
}

export function parseDialogText(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  let autoIdx = 0;
  for (const line of lines) {
    // Oldingi qatorning tarjimasi: (…) yoki → … yoki "tarjima: …"
    const trMatch = line.match(/^\((.+)\)$/) || line.match(/^(?:→|->|tarjima:)\s*(.+)$/i);
    if (trMatch && out.length && !out[out.length - 1][2]) {
      out[out.length - 1][2] = trMatch[1].trim();
      continue;
    }
    const m = line.match(SPEAKER_RE);
    let speaker;
    let rest;
    if (m && !/^https?$/i.test(m[1])) {
      speaker = m[1].trim();
      rest = m[2];
    } else {
      speaker = autoIdx % 2 === 0 ? 'A' : 'B';
      rest = line;
    }
    autoIdx += 1;
    const [text, tr] = splitTranslation(rest);
    if (text) out.push([speaker, text, tr]);
  }
  return out;
}
