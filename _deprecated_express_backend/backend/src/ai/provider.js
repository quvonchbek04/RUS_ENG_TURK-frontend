// AI provider qatlami — matn/dialog bo'yicha vazifa yaratish va javobni tekshirish.
// AI_PROVIDER=mock  -> tashqi API chaqirilmaydi, oddiy qoidaviy (rule-based) vazifalar generatsiya qilinadi.
// AI_PROVIDER=gemini -> Google Gemini API ishlatiladi (kalit kerak).
// Kalit admin panelidan (ustuvor) yoki backend/.env faylidan (zaxira) olinadi.
// Kalit hali kiritilmagan yoki so'rov muvaffaqiyatsiz bo'lsa, avtomatik "mock" rejimiga qaytadi —
// ilova hech qachon AI yo'qligi sababli buzilib qolmaydi.

import { getSetting, setSetting } from "../db.js";

const LANG_NAMES = { ru: "rus tili", en: "ingliz tili", tr: "turk tili" };

function getApiKey() {
  return getSetting("gemini_api_key", "") || process.env.GEMINI_API_KEY || "";
}

function getConfiguredProvider() {
  const dbProvider = getSetting("ai_provider", "");
  if (dbProvider) return dbProvider.toLowerCase();
  return (process.env.AI_PROVIDER || "mock").toLowerCase();
}

function getProvider() {
  const configured = getConfiguredProvider();
  if (configured === "gemini" && getApiKey()) return "gemini";
  return "mock";
}

export function aiStatus() {
  const provider = getProvider();
  return {
    provider,
    hasKey: Boolean(getApiKey()),
    configuredProvider: getConfiguredProvider(),
  };
}

/** Admin panelidan API kalit va provayderni saqlash. */
export function saveAiSettings({ geminiApiKey, provider }) {
  if (typeof geminiApiKey === "string") setSetting("gemini_api_key", geminiApiKey.trim());
  if (provider) setSetting("ai_provider", String(provider).toLowerCase());
}

/* ================= MOCK (qoidaviy, kalitsiz ishlaydigan) generator ================= */

function pickSentence(text) {
  const parts = (text || "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  if (!parts.length) return (text || "").slice(0, 140);
  return parts[Math.floor(Math.random() * Math.min(parts.length, 8))];
}

function mockReadingTask({ content, lang }) {
  const sentence = pickSentence(content);
  const langName = LANG_NAMES[lang] || lang;
  const templates = [
    `Quyidagi jumlani o'zbek tiliga tarjima qiling: "${sentence}"`,
    `Ushbu jumla mazmunini o'z so'zlaringiz bilan (${langName}da yoki o'zbekcha) qisqacha tushuntiring: "${sentence}"`,
    `Matndan olingan ushbu jumlani o'qib, unda ishlatilgan kamida 3 ta yangi so'zni ajrating va ma'nosini yozing: "${sentence}"`,
  ];
  return {
    question: templates[Math.floor(Math.random() * templates.length)],
    hint: "Javobingizni pastdagi maydonga yozing va \"Javobni tekshirish\" tugmasini bosing.",
  };
}

function mockDialogTask({ content, lang }) {
  const langName = LANG_NAMES[lang] || lang;
  const sentence = pickSentence(content);
  const templates = [
    `Ushbu dialogdagi vaziyatni davom ettirib, yana 2 ta gap (${langName}da) yozing.`,
    `Dialogdagi ushbu jumlani boshqacha, ammo xuddi shu ma'noni beruvchi tarzda qayta yozing: "${sentence}"`,
    `Agar siz shu suhbatdagi ikkinchi spiker bo'lganingizda, qanday javob berardingiz? (${langName}da yozing)`,
  ];
  return {
    question: templates[Math.floor(Math.random() * templates.length)],
    hint: "Javobingizni pastdagi maydonga yozing va \"Javobni tekshirish\" tugmasini bosing.",
  };
}

function mockCheckAnswer({ answer }) {
  const trimmed = (answer || "").trim();
  if (trimmed.length < 3) {
    return { correct: false, feedback: "Javobingiz juda qisqa ko'rinadi — biroz kengroq yozib ko'ring." };
  }
  if (trimmed.length < 15) {
    return {
      correct: true,
      feedback: "Rahmat! Javobingiz qabul qilindi. (Eslatma: hozircha oddiy tekshiruv rejimi ishlamoqda — to'liq AI baholash uchun administratordan Gemini API kalitini faollashtirishni so'rang.)",
    };
  }
  return {
    correct: true,
    feedback: "Ajoyib, batafsil javob yozibsiz! Davom eting. (Eslatma: hozircha oddiy tekshiruv rejimi ishlamoqda — to'liq AI baholash uchun administratordan Gemini API kalitini faollashtirishni so'rang.)",
  };
}

/* ================= GEMINI (haqiqiy AI) ================= */

async function callGemini(prompt) {
  const key = getApiKey();
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini so'rovi muvaffaqiyatsiz (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  return text.trim();
}

async function geminiReadingTask({ content, lang }) {
  const langName = LANG_NAMES[lang] || lang;
  const excerpt = (content || "").slice(0, 2500);
  const prompt = `Sen ${langName}ni o'rganayotgan o'zbek tilida so'zlashuvchi talaba uchun til o'qituvchisisan. Quyidagi matn asosida talabaga bitta qisqa, aniq va bajarilishi mumkin bo'lgan o'qish-tushunish vazifasini (savol yoki topshiriq) O'ZBEK TILIDA yoz. Faqat vazifa matnini qaytar, boshqa hech narsa yozma.\n\nMatn:\n"""${excerpt}"""`;
  const question = await callGemini(prompt);
  return { question: question || mockReadingTask({ content, lang }).question, hint: "Javobingizni pastdagi maydonga yozing va \"Javobni tekshirish\" tugmasini bosing." };
}

async function geminiDialogTask({ content, lang }) {
  const langName = LANG_NAMES[lang] || lang;
  const excerpt = (content || "").slice(0, 2500);
  const prompt = `Sen ${langName}ni o'rganayotgan o'zbek tilida so'zlashuvchi talaba uchun til o'qituvchisisan. Quyidagi dialog asosida talabaga bitta qisqa, aniq va bajarilishi mumkin bo'lgan amaliy vazifa (masalan davom ettirish, qayta yozish, yoki o'z javobini yozish) O'ZBEK TILIDA yoz. Faqat vazifa matnini qaytar, boshqa hech narsa yozma.\n\nDialog:\n"""${excerpt}"""`;
  const question = await callGemini(prompt);
  return { question: question || mockDialogTask({ content, lang }).question, hint: "Javobingizni pastdagi maydonga yozing va \"Javobni tekshirish\" tugmasini bosing." };
}

async function geminiCheckAnswer({ context, question, answer, lang }) {
  const langName = LANG_NAMES[lang] || lang;
  const prompt = `Sen ${langName}ni o'rganayotgan o'zbek tilida so'zlashuvchi talabaning javobini tekshiruvchi mehribon til o'qituvchisisan.\n\nAsl matn/dialog (qisqartirilgan):\n"""${(context || "").slice(0, 1500)}"""\n\nVazifa: "${question}"\n\nTalabaning javobi: "${answer}"\n\nJavobni baholab, O'ZBEK TILIDA 2-4 gapdan iborat qisqa, iliq va foydali fikr-mulohaza (feedback) yoz — xatolar bo'lsa muloyimlik bilan tuzatib ko'rsat, yaxshi tomonlarini ham aytib o't. Faqat fikr-mulohaza matnini qaytar.`;
  const feedback = await callGemini(prompt);
  return { correct: true, feedback: feedback || mockCheckAnswer({ answer }).feedback };
}

/* ================= Umumiy interfeys (routes shu funksiyalarni chaqiradi) ================= */

export async function generateTask({ type, content, lang }) {
  const provider = getProvider();
  try {
    if (provider === "gemini") {
      return type === "dialog" ? await geminiDialogTask({ content, lang }) : await geminiReadingTask({ content, lang });
    }
  } catch (err) {
    console.error("Gemini xatosi, mock rejimiga o'tildi:", err.message);
  }
  return type === "dialog" ? mockDialogTask({ content, lang }) : mockReadingTask({ content, lang });
}

export async function checkAnswer({ context, question, answer, lang }) {
  const provider = getProvider();
  try {
    if (provider === "gemini") {
      return await geminiCheckAnswer({ context, question, answer, lang });
    }
  } catch (err) {
    console.error("Gemini xatosi, mock rejimiga o'tildi:", err.message);
  }
  return mockCheckAnswer({ answer });
}
