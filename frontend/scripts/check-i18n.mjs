// Tarjimalarni tekshiradi:  node scripts/check-i18n.mjs [--leftovers] [--unused]
//  1) lug'at qatorlari to'g'rimi (4 ta matn, {o'zgaruvchilar} hamma tilda bir xil, takror kalit yo'q)
//  2) kodda t("...") bilan yozilgan har bir kalit lug'atda bormi
//  --leftovers: t() ga o'ralmagan, tarjima qilinishi kerak bo'lishi mumkin bo'lgan matnlar (JSX matni, placeholder/title…, bosh harfli satrlar)
//  --unused:    kodda uchramaydigan lug'at kalitlari
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const dictDir = path.join(srcDir, 'i18n', 'dict');
const args = new Set(process.argv.slice(2));

// ---------- lug'at ----------
const rows = [];
for (const f of fs.readdirSync(dictDir)) {
  if (!f.endsWith('.js') || f === 'index.js') continue;
  const mod = await import(pathToFileURL(path.join(dictDir, f)).href);
  for (const r of mod.default) rows.push({ file: f, row: r });
}
const problems = [];
const seen = new Map();
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const { file, row } of rows) {
  if (!Array.isArray(row) || row.length !== 4 || row.some((x) => typeof x !== 'string' || !x.trim())) {
    problems.push(`${file}: noto'g'ri qator: ${JSON.stringify(row).slice(0, 100)}`);
    continue;
  }
  if (seen.has(row[0])) problems.push(`${file}: takror kalit (${seen.get(row[0])} da ham bor): ${row[0].slice(0, 70)}`);
  seen.set(row[0], file);
  const v = vars(row[0]);
  row.slice(1).forEach((tr, i) => {
    if (vars(tr) !== v) problems.push(`${file}: o'zgaruvchilar mos emas [${['ru', 'en', 'tr'][i]}] (${v} ≠ ${vars(tr)}): ${row[0].slice(0, 60)}`);
  });
}
const keys = new Set(seen.keys());

// ---------- manba fayllar ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p === path.join(srcDir, 'i18n', 'dict')) continue;
      walk(p, out);
    } else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(srcDir);

const unescape = (s) =>
  s.replace(/\\(['"`\\nrt])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t' }[c] ?? c)).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, (m, p1) => p1))
    .join('\n');
}

const STR = /'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\$])*)`/g;
const usedLiterals = new Set();
const missing = [];
const leftovers = [];

for (const file of files) {
  const rel = path.relative(srcDir, file).replace(/\\/g, '/');
  const raw = fs.readFileSync(file, 'utf8');
  const code = stripComments(raw);
  const lines = code.split('\n');

  // t("...") chaqiruvlari
  for (const m of code.matchAll(/\bt\(\s*(?:'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\$])*)`)/g)) {
    const key = unescape(m[1] ?? m[2] ?? m[3]);
    const line = code.slice(0, m.index).split('\n').length;
    if (!keys.has(key)) missing.push(`${rel}:${line}  ${key.slice(0, 90)}`);
  }
  for (const m of code.matchAll(STR)) usedLiterals.add(unescape(m[1] ?? m[2] ?? m[3] ?? ''));

  if (!args.has('--leftovers')) continue;
  const ATTR = /\b(placeholder|title|aria-label|alt|label|subtitle|eyebrow|text|description|hint|help|summary|heading|caption)="([^"{}]*[A-Za-zА-Яа-я][^"{}]*)"/g;
  lines.forEach((line, i) => {
    const n = i + 1;
    const trimmed = line.trim();
    if (!trimmed || /^(import|export|\*|\/\/)/.test(trimmed)) return;
    // JSX matni:  >matn<
    for (const m of line.matchAll(/>([^<>{}\n]*[A-Za-zА-Яа-яЁё][^<>{}\n]*)</g)) {
      const txt = m[1].trim();
      if (txt && /[A-Za-zА-Яа-я]{2}/.test(txt) && !/^[=&|?:;,.()+\-*/\d\s]*$/.test(txt)) leftovers.push(`${rel}:${n}  [jsx] ${txt.slice(0, 80)}`);
    }
    // ko'p qatorli JSX matni (faqat matn turgan qator)
    if (!/[{}<>=;`$]/.test(trimmed.replace(/[«»"“”]/g, '')) && /^[A-ZА-Я0-9•·⚠️✅❌🔒📱📧🤖🔑✏️🗑⬆⬇←-⇿☀-➿\uD83C-\uDBFF'"«(–—-]/u.test(trimmed) && /\s/.test(trimmed) && /[A-Za-z]{3}/.test(trimmed) && !/^(case|return|else|break|const|let|var|if|for|while|try|catch|throw|await|async|function|default)\b/.test(trimmed)) {
      leftovers.push(`${rel}:${n}  [jsx-line] ${trimmed.slice(0, 80)}`);
    }
    for (const m of line.matchAll(ATTR)) leftovers.push(`${rel}:${n}  [attr ${m[1]}] ${m[2].slice(0, 80)}`);
    // bosh harfli matn literallari t() ga o'ralmagan
    for (const m of line.matchAll(STR)) {
      const s = unescape(m[1] ?? m[2] ?? m[3] ?? '');
      // Inson matniga o'xshash literallar: bosh harfli yoki (probel + tinish/apostrof/unicode) bo'lgan lotin so'zlar
      const stripped = s.replace(/\[[^\]]*\]/g, '');
      const humanLower = /\s/.test(stripped) && /[A-Za-z]{3}/.test(stripped) && /['’,.…—?!:;]|[^\x00-\x7F]/.test(stripped) && !/^[a-z0-9\-_:/%#@.()!\s,]+$/.test(stripped);
      const capital = /^[A-ZА-Я][^\n]{3,}$/.test(s) && !/^[A-Z0-9_ :,.\-/]+$/.test(s);
      if (!capital && !humanLower) continue;
      if (/^(Content-Type|Authorization|Bearer|Escape|Enter|Tab|Arrow|Space|Backspace|Accept|POST|GET|PUT|DELETE)/.test(s)) continue;
      const before = line.slice(0, m.index);
      if (/\bt\(\s*$/.test(before) || /className\s*=\s*$/.test(before)) continue;
      if (keys.has(s)) continue; // lug'atda bor (t() orqali dinamik o'giriladigan kalit)
      leftovers.push(`${rel}:${n}  [literal] ${s.slice(0, 80)}`);
    }
  });
}

let bad = 0;
if (problems.length) {
  console.log(`\n❌ Lug'at muammolari (${problems.length}):`);
  problems.slice(0, 60).forEach((p) => console.log('  ' + p));
  bad += problems.length;
}
if (missing.length) {
  console.log(`\n❌ Lug'atda yo'q kalitlar (${missing.length}):`);
  missing.slice(0, 200).forEach((p) => console.log('  ' + p));
  bad += missing.length;
}
if (args.has('--leftovers')) {
  console.log(`\n⚠ Tarjima qilinmagan bo'lishi mumkin (${leftovers.length}):`);
  leftovers.forEach((p) => console.log('  ' + p));
}
if (args.has('--unused')) {
  const unused = [...keys].filter((k) => !usedLiterals.has(k));
  console.log(`\nℹ Kodda uchramagan kalitlar (${unused.length}):`);
  unused.slice(0, 200).forEach((k) => console.log('  ' + k.slice(0, 90)));
}
console.log(`\nLug'at qatorlari: ${rows.length}; fayllar: ${files.length}; ${bad ? 'XATOLAR: ' + bad : '✅ lug\'at va t() kalitlari mos'}`);
process.exit(bad ? 1 : 0);
