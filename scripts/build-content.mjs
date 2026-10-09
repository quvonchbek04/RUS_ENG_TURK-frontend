#!/usr/bin/env node
/**
 * Kurs kontentini yig'ish skripti.
 *
 * Kirish (data-src/):
 *   content.original.json   — asl kurs (ingliz, rus, turk tillari: 33 tadan dars)
 *   words_en.json           — Word fayl: 2161 ta so'z (24 bo'lim) + gap + gap tarjimasi
 *   phrases_en.json         — Word fayl: 297 ta ibora (20 bo'lim) + gap + gap tarjimasi
 *   lesson_extras_en.json   — ingliz tili darslari uchun 2-dialog, qo'shimcha grammatika, o'qish matni
 *   i18n/words_ru_tr*.txt   — so'zlarning rus va turk tilidagi tarjimasi
 *   i18n/phrases_ru_tr*.txt — iboralarning rus va turk tilidagi tarjimasi
 *     format: "bo'lim.qator|rus so'z|rus gap|turk so'z|turk gap"  (masalan: 1.1|быть|Я хочу быть врачом.|olmak|Doktor olmak istiyorum.)
 *
 * Chiqish (frontend/public/content/):
 *   meta.json  — tillar ro'yxati, bo'lim nomlari
 *   en.json, ru.json, tr.json — har bir til: darslar (so'z/iboralar havola sifatida), lug'at banki va h.k.
 *
 * Har bir so'z/ibora aynan BITTA darsga biriktiriladi (uchala tilda bir xil taqsimot).
 * Ishga tushirish:  node scripts/build-content.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'data-src');
const OUT = path.join(ROOT, 'frontend', 'public', 'content');

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(SRC, p), 'utf8'));

/** rng(1, [5, 9]) -> [1, 5, 6, 7, 8, 9]  (1-asosli tartib raqamlari) */
function rng(...parts) {
  const res = [];
  for (const p of parts) {
    if (Array.isArray(p)) for (let i = p[0]; i <= p[1]; i++) res.push(i);
    else res.push(p);
  }
  return res;
}

// ---------------------------------------------------------------------------
// SO'ZLAR: bo'lim (1..24) -> { dars_id: [tartib raqamlari] }
// Tartib raqami — o'sha bo'limdagi (olib tashlanganlardan keyingi) o'rni.
// ---------------------------------------------------------------------------
const WORD_ALLOC = {
  1: { m2: rng([1, 55]), m4: rng([56, 110]), 'guide-a1': rng([111, 170]), 'guide-a2': rng([171, 210]), m10: rng([211, 240]), m11: rng([241, 270]), 'guide-b1': rng([271, 294]) },
  2: { m17: rng([1, 23]), m1: rng([24, 67]) },
  3: { m13: 'ALL' },
  4: { m17: rng([1, 55]), m20: rng([56, 77]) },
  5: { m19: 'ALL' },
  6: { m24: 'ALL' },
  7: { m22: 'ALL' },
  8: { m14: 'ALL' },
  9: { m21: rng([1, 35]), m26: rng([36, 65]) },
  10: { m18: rng([1, 40]), m5: rng([41, 100]), m10: rng([101, 130]), 'guide-b1': rng([131, 156]) },
  11: { m18: 'ALL' },
  12: { m3: 'ALL' },
  13: { m20: 'ALL' },
  14: { m25: 'ALL' },
  15: { m8: rng([1, 30]), m16: rng([31, 56]) },
  16: { m15: rng([1, 12], [23, 37]), m27: rng([13, 22]) },
  17: { m9: rng([1, 16]), m11: rng([17, 27]), m28: rng([28, 33]), m12: rng([34, 43]) },
  18: { m3: rng([1, 2], [23, 55]), m7: rng([3, 22]), m0: rng([56, 62], [141, 148]), m1: rng([63, 76]), m6: rng([77, 115]), m5: rng([116, 140]) },
  19: { m23: 'ALL' },
  20: 'BY_WORD',
  21: { m11: rng([1, 23]), m9: rng([24, 47]) },
  22: { m8: rng([1, 25]), m9: rng([26, 50]), m12: rng([51, 80]), 'guide-b2': rng([81, 136]) },
  23: { 'guide-a2': rng([1, 40]), m10: rng([41, 90]), 'guide-b1': rng([91, 140]), 'guide-b2': rng([141, 205]) },
  24: 'THEMED',
};

const SERVICES_BY_WORD = {
  m8: ['form', 'queue', 'ID card', 'fee', 'fine', 'permit', 'insurance'],
  m13: ['emergency', 'ambulance', 'danger', 'safety'],
  // qolganlari -> m22
};

const NOUN_THEMES = {
  m15: 'device cable code machine equipment instrument tool system method process structure version unit formula alarm'.split(' '),
  m26: 'climate environment pollution resource harvest crop landscape cave breeze flame smoke grain horizon population damage'.split(' '),
  m27: 'article author journal audience chart survey claim source content context draft record image reception background frame'.split(' '),
  m28: 'poem poet drama architecture plot scene rhythm inspiration passion beauty symbol theme palace heritage glory exhibition applause gesture ceremony anniversary fame kingdom empire era fabric pattern'.split(' '),
  m25: 'lecture research theory experiment discovery pupil ability effort challenge difficulty instance phrase term level proof exception'.split(' '),
  m13: 'breath nerve remedy hunger balance comfort condition shock tension birth death welfare'.split(' '),
  m14: 'junction route path frontier boundary gate entrance slope ladder pace zone'.split(' '),
  m16: 'award champion victory reputation honor mission outcome strategy priority responsibility role procedure benefit advantage disadvantage'.split(' '),
  m8: 'policy principle agency department majority minority nation state region property command demand military army'.split(' '),
  m11: 'debate conflict quarrel threat violence battle weapon consequence crisis burden barrier witness trap odds'.split(' '),
  m9: 'detail difference moment occasion situation appearance impact intention mess shame pride courage silence shadow darkness spirit sense feature gap'.split(' '),
};
const NOUN_REST_ORDER = ['guide-a1', 'guide-a2', 'm10', 'm12', 'guide-b1', 'guide-b2'];

// Kurs lug'atida allaqachon bor bo'lgan so'zlar darslarga qayta qo'shilmaydi (lug'at bankida qoladi)
const WORD_REMOVE = new Set(['belong to', 'sit down', 'manage to', 'delivery man', 'post', 'harbor', 'ill', 'error', 'disease', 'dish']);

const PHR_ALLOC = {
  1: { m0: rng([1, 9]), 'guide-a1': rng([10, 15]) },
  2: { m4: 'ALL' },
  3: { m1: 'ALL' },
  4: { m11: rng([1, 8]), m7: rng([9, 12]), 'guide-b1': rng([13, 15]) },
  5: { m3: rng([1, 10]), 'guide-a1': rng([11, 15]) },
  6: { m2: 'ALL' },
  7: { m5: rng([1, 10]), 'guide-a2': rng([11, 15]) },
  8: { m20: 'ALL' },
  9: { m19: 'ALL' },
  10: { m18: rng([1, 5]), m24: rng([6, 15]) },
  11: { m22: rng(1, 2, 3, 7, 8), m6: rng(4, 5, 6, 14, 15), m14: rng([9, 13]) },
  12: { m15: rng([1, 8]), m27: rng([9, 15]) },
  13: { m8: rng([1, 5]), m16: rng([6, 13]), m25: rng([14, 15]) },
  14: { m9: rng([1, 8]), m28: rng([9, 15]) },
  15: { m13: 'ALL' },
  16: { m21: rng([1, 10]), m26: rng([11, 15]) },
  17: { m17: 'ALL' },
  18: { m14: 'ALL' },
  19: { m10: rng([1, 8]), m12: rng([9, 12]), 'guide-b2': rng([13, 15]) },
  20: { m8: rng([1, 10]), 'guide-b2': rng([11, 14]) },
};
const PHR_REMOVE = new Set(['Under the weather', 'Can you give me a hand?', 'Honestly...']);

function fail(msg) {
  console.error('XATO: ' + msg);
  process.exit(1);
}

/** items: [{orig}], spec: {dars: 'ALL' | indekslar} -> {dars: [orig indekslar]} (+ tekshiruv). */
function allocSection(items, spec, label) {
  const n = items.length;
  const out = {};
  const used = new Set();
  for (const [lesson, idxsRaw] of Object.entries(spec)) {
    const idxs = idxsRaw === 'ALL' ? rng([1, n]) : idxsRaw;
    for (const i of idxs) {
      if (i < 1 || i > n) continue; // olib tashlangan elementlar tufayli bo'lim qisqargan
      if (used.has(i)) fail(`${label}: ${i}-element ikki marta taqsimlangan`);
      used.add(i);
      (out[lesson] ||= []).push(items[i - 1].orig);
    }
  }
  const missing = [];
  for (let i = 1; i <= n; i++) if (!used.has(i)) missing.push(i);
  if (missing.length) fail(`${label}: taqsimlanmagan elementlar: ${missing.slice(0, 10).join(', ')} (${missing.length} ta)`);
  return out;
}

/** Har bir dars uchun [bo'lim indeksi (0..), asl qator indeksi (0..)] ro'yxatini tuzadi. */
function allocateWords(words) {
  const lessons = {};
  const push = (lesson, s, r) => (lessons[lesson] ||= []).push([s, r]);
  words.forEach((sec, s0) => {
    const si = s0 + 1;
    const rows = sec.rows.map((row, orig) => ({ row, orig })).filter(({ row }) => !WORD_REMOVE.has(row[0].toLowerCase()));
    const spec = WORD_ALLOC[si];
    if (spec === 'THEMED') {
      const byKey = new Map(rows.map((x) => [x.row[0].toLowerCase(), x]));
      const taken = new Set();
      for (const [lesson, ws] of Object.entries(NOUN_THEMES)) {
        for (const w of ws) {
          if (!byKey.has(w)) fail(`Mavzuli ot topilmadi: ${w}`);
          if (taken.has(w)) fail(`Mavzuli ot takrorlangan: ${w}`);
          taken.add(w);
          push(lesson, s0, byKey.get(w).orig);
        }
      }
      const rest = rows.filter((x) => !taken.has(x.row[0].toLowerCase()));
      const size = Math.ceil(rest.length / NOUN_REST_ORDER.length);
      NOUN_REST_ORDER.forEach((lesson, j) => rest.slice(j * size, (j + 1) * size).forEach((x) => push(lesson, s0, x.orig)));
    } else if (spec === 'BY_WORD') {
      const byKey = new Map(rows.map((x) => [x.row[0], x]));
      const taken = new Set();
      for (const [lesson, ws] of Object.entries(SERVICES_BY_WORD)) {
        for (const w of ws) {
          if (!byKey.has(w)) fail(`Xizmat so'zi topilmadi: ${w}`);
          push(lesson, s0, byKey.get(w).orig);
          taken.add(w);
        }
      }
      rows.filter((x) => !taken.has(x.row[0])).forEach((x) => push('m22', s0, x.orig));
    } else {
      for (const [lesson, origs] of Object.entries(allocSection(rows, spec, `So'z bo'limi ${si}`))) origs.forEach((o) => push(lesson, s0, o));
    }
  });
  return lessons;
}

function allocatePhrases(phrases) {
  const lessons = {};
  phrases.forEach((sec, s0) => {
    const rows = sec.rows.map((row, orig) => ({ row, orig })).filter(({ row }) => !PHR_REMOVE.has(row[0]));
    for (const [lesson, origs] of Object.entries(allocSection(rows, PHR_ALLOC[s0 + 1], `Ibora bo'limi ${s0 + 1}`))) {
      origs.forEach((o) => (lessons[lesson] ||= []).push([s0, o]));
    }
  });
  return lessons;
}

/** i18n fayllarini o'qiydi: "S.N" -> { ru: [so'z, gap], tr: [so'z, gap] } */
function readTranslations(prefix) {
  const dir = path.join(SRC, 'i18n');
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.txt')).sort();
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
    lines.forEach((line, ln) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const parts = t.split('|').map((x) => x.trim());
      if (parts.length !== 5) fail(`${f}:${ln + 1}: 5 ta ustun kutilgan, ${parts.length} ta topildi: ${t}`);
      const [key, ruW, ruS, trW, trS] = parts;
      if (!/^\d+\.\d+$/.test(key)) fail(`${f}:${ln + 1}: noto'g'ri kalit "${key}"`);
      if (map.has(key)) fail(`${f}:${ln + 1}: "${key}" takrorlangan`);
      if (!ruW || !ruS || !trW || !trS) fail(`${f}:${ln + 1}: bo'sh ustun bor`);
      // "-" — shu tilda mos so'z yo'q (masalan, ingliz artikllari): ataylab tashlab ketiladi
      map.set(key, { ru: ruW === '-' ? null : [ruW, ruS], tr: trW === '-' ? null : [trW, trS], skip: ruW === '-' || trW === '-' });
    });
  }
  return map;
}

/** Til uchun bank tuzadi. Tarjimasi yo'q qatorlar tashlab yuboriladi, havolalar qayta raqamlanadi. */
function buildBank(sections, lang, tr) {
  const remap = [];
  const bank = sections.map((sec, s0) => {
    const rows = [];
    const m = new Map();
    sec.rows.forEach((row, r0) => {
      let out;
      if (lang === 'en') out = [row[0], row[1], row[2], row[3]];
      else {
        const t = tr.get(`${s0 + 1}.${r0 + 1}`);
        if (!t || !t[lang]) return;
        out = [t[lang][0], row[1], t[lang][1], row[3]];
      }
      m.set(r0, rows.length);
      rows.push(out);
    });
    remap.push(m);
    return { title: sec.title, rows };
  });
  return { bank, remap };
}

/** Rus/turk tili uchun 2-dialog va o'qish matnini ingliz manbasi bilan birlashtiradi.
 *  i18n/lesson_extras_<til>.json: { _speakers: {...}, <dars>: { dialog2: {title, lines: ["matn" | ["matn", "o'zbekcha"]]},
 *  reading: {title, text, uz?, questions: [[savol, javob]]} } }. O'zbekcha tarjima ko'rsatilmasa — inglizchadagisi olinadi. */
function localizedExtras(lang, enExtras) {
  const p = path.join(SRC, 'i18n', `lesson_extras_${lang}.json`);
  if (!fs.existsSync(p)) return {};
  const src = JSON.parse(fs.readFileSync(p, 'utf8'));
  const speakers = src._speakers || {};
  const out = {};
  for (const [id, ex] of Object.entries(src)) {
    if (id.startsWith('_')) continue;
    const en = enExtras[id];
    if (!en) fail(`lesson_extras_${lang}.json: "${id}" ingliz manbasida yo'q`);
    const res = {};
    if (ex.dialog2) {
      const enLines = en.dialog2?.lines || [];
      if (ex.dialog2.lines.length !== enLines.length) {
        fail(`lesson_extras_${lang}.json: ${id} dialogida ${ex.dialog2.lines.length} qator, inglizchada ${enLines.length}`);
      }
      res.dialog2 = {
        title: ex.dialog2.title,
        lines: enLines.map((l, i) => {
          const t = ex.dialog2.lines[i];
          const [text, uz] = Array.isArray(t) ? t : [t, l[2]];
          return [speakers[l[0]] || l[0], text, uz];
        }),
      };
    }
    if (ex.reading) {
      res.reading = {
        title: ex.reading.title,
        text: ex.reading.text,
        uz: ex.reading.uz || en.reading?.uz || '',
        questions: ex.reading.questions || [],
      };
    }
    out[id] = res;
  }
  return out;
}

function mapRefs(refs, remap) {
  return (refs || []).map(([s, r]) => (remap[s].has(r) ? [s, remap[s].get(r)] : null)).filter(Boolean);
}

function main() {
  const content = readJson('content.original.json');
  const words = readJson('words_en.json');
  const phrases = readJson('phrases_en.json');
  const extras = fs.existsSync(path.join(SRC, 'lesson_extras_en.json')) ? readJson('lesson_extras_en.json') : {};
  const wordTr = readTranslations('words_ru_tr');
  const phrTr = readTranslations('phrases_ru_tr');

  const lessonWords = allocateWords(words);
  const lessonPhr = allocatePhrases(phrases);

  const ids = new Set(content.DATA_EN.flatMap((g) => g.months.map((m) => m.id)));
  for (const lid of [...Object.keys(lessonWords), ...Object.keys(lessonPhr)]) if (!ids.has(lid)) fail(`Noma'lum dars id: ${lid}`);

  const expectedW = words.reduce((s, sec) => s + sec.rows.filter((r) => !WORD_REMOVE.has(r[0].toLowerCase())).length, 0);
  const totalW = Object.values(lessonWords).reduce((s, a) => s + a.length, 0);
  if (expectedW !== totalW) fail(`so'zlar soni mos emas: ${totalW} != ${expectedW}`);

  fs.mkdirSync(OUT, { recursive: true });

  const LANG_SPEC = { en: ['DATA_EN', 'DICT_EXTRA_EN', 'IRREGULAR_VERBS_EN', 'DIALOGS_EXTRA_EN'], ru: ['DATA_RU', 'DICT_EXTRA_RU', 'VERB_TABLE_RU', 'DIALOGS_EXTRA_RU'], tr: ['DATA_TR', 'DICT_EXTRA_TR', 'VERB_TABLE_TR', 'DIALOGS_EXTRA_TR'] };
  const LANGS = JSON.parse(JSON.stringify(content.LANGS));
  const report = [];

  for (const [lang, [dataKey, dictKey, verbKey, dlgKey]] of Object.entries(LANG_SPEC)) {
    const { bank: wordbank, remap: wRemap } = buildBank(words, lang, wordTr);
    const { bank: phrasebank, remap: pRemap } = buildBank(phrases, lang, phrTr);
    const modules = JSON.parse(JSON.stringify(content[dataKey]));
    const locExtras = lang === 'en' ? {} : localizedExtras(lang, extras);
    let lessonCount = 0;
    let wCount = 0;
    let pCount = 0;
    let extraCount = 0;
    for (const group of modules) {
      for (const month of group.months) {
        lessonCount += 1;
        month.words = mapRefs(lessonWords[month.id], wRemap);
        month.phrases = mapRefs(lessonPhr[month.id], pRemap);
        wCount += month.words.length;
        pCount += month.phrases.length;
        if (lang === 'en') {
          const ex = extras[month.id];
          if (ex?.dialog2) month.dialog2 = ex.dialog2;
          if (ex?.grammarMore) month.grammar.more = ex.grammarMore;
          if (ex?.reading) month.reading = ex.reading;
          if (ex?.tasks2) month.tasks = [...month.tasks, ...ex.tasks2];
          if (ex?.dialog2 || ex?.reading) extraCount += 1;
        } else {
          const ex = locExtras[month.id];
          if (ex?.dialog2) month.dialog2 = ex.dialog2;
          if (ex?.reading) month.reading = ex.reading;
          if (ex?.dialog2 || ex?.reading) extraCount += 1;
        }
      }
    }
    const file = {
      lang,
      modules,
      dictExtra: content[dictKey] || [],
      verbTable: content[verbKey] || [],
      dialogsExtra: content[dlgKey] || [],
      wordbank,
      phrasebank,
    };
    fs.writeFileSync(path.join(OUT, `${lang}.json`), JSON.stringify(file));
    LANGS[lang].lessonCount = lessonCount;
    const bankW = wordbank.reduce((s, c) => s + c.rows.length, 0);
    const bankP = phrasebank.reduce((s, c) => s + c.rows.length, 0);
    LANGS[lang].wordCount = bankW;
    LANGS[lang].phraseCount = bankP;
    report.push(`  ${lang}: ${lessonCount} dars · lug'at banki ${bankW} so'z / ${bankP} ibora · darslarda ${wCount} so'z, ${pCount} ibora · 2-dialog va o'qish matni: ${extraCount} dars · ${(fs.statSync(path.join(OUT, `${lang}.json`)).size / 1024).toFixed(0)} KB`);
  }

  const meta = {
    version: new Date().toISOString().slice(0, 10),
    LANGS,
    TABS: content.TABS,
    wordCats: words.map((s) => s.title),
    phraseCats: phrases.map((s) => s.title),
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta));

  const missW = words.reduce((s, sec, s0) => s + sec.rows.filter((_, r0) => !wordTr.has(`${s0 + 1}.${r0 + 1}`)).length, 0);
  const missP = phrases.reduce((s, sec, s0) => s + sec.rows.filter((_, r0) => !phrTr.has(`${s0 + 1}.${r0 + 1}`)).length, 0);
  console.log('OK — frontend/public/content/ yangilandi');
  report.forEach((l) => console.log(l));
  if (missW || missP) console.log(`  ⚠ Tarjimasi yo'q (rus/turk): ${missW} so'z, ${missP} ibora`);
}

main();
