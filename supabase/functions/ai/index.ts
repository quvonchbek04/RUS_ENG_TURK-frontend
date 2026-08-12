// Edge Function: /functions/v1/ai
// Har qanday tizimga kirgan foydalanuvchi chaqira oladi. Gemini API kalitini
// hech qachon klientga chiqarmaydi — kalit secure_settings jadvalida saqlanadi
// va faqat shu funksiya ichida (service-role orqali) o'qiladi.
//
// So'rov formati: POST { action: "status" } |
//                       { action: "task", type: "text"|"dialog", content, lang } |
//                       { action: "check", context, question, answer, lang }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

const LANG_NAMES: Record<string, string> = { ru: "rus tili", en: "ingliz tili", tr: "turk tili" };

async function getAiConfig(admin: ReturnType<typeof createClient>) {
  const { data: providerRow } = await admin.from("settings").select("value").eq("key", "ai_provider").single();
  const { data: keyRow } = await admin.from("secure_settings").select("value").eq("key", "gemini_api_key").single();
  const configuredProvider = (providerRow?.value || "mock").toLowerCase();
  const apiKey = keyRow?.value || "";
  const provider = configuredProvider === "gemini" && apiKey ? "gemini" : "mock";
  return { provider, configuredProvider, hasKey: Boolean(apiKey), apiKey };
}

function pickSentence(text: string): string {
  const parts = (text || "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  if (!parts.length) return (text || "").slice(0, 140);
  return parts[Math.floor(Math.random() * Math.min(parts.length, 8))];
}

function mockTask(type: string, content: string, lang: string) {
  const langName = LANG_NAMES[lang] || lang;
  const sentence = pickSentence(content);
  const textTemplates = [
    `Quyidagi jumlani o'zbek tiliga tarjima qiling: "${sentence}"`,
    `Ushbu jumla mazmunini o'z so'zlaringiz bilan (${langName}da yoki o'zbekcha) qisqacha tushuntiring: "${sentence}"`,
    `Matndan olingan ushbu jumlani o'qib, unda ishlatilgan kamida 3 ta yangi so'zni ajrating va ma'nosini yozing: "${sentence}"`,
  ];
  const dialogTemplates = [
    `Ushbu dialogdagi vaziyatni davom ettirib, yana 2 ta gap (${langName}da) yozing.`,
    `Dialogdagi ushbu jumlani boshqacha, ammo xuddi shu ma'noni beruvchi tarzda qayta yozing: "${sentence}"`,
    `Agar siz shu suhbatdagi ikkinchi spiker bo'lganingizda, qanday javob berardingiz? (${langName}da yozing)`,
  ];
  const templates = type === "dialog" ? dialogTemplates : textTemplates;
  return {
    question: templates[Math.floor(Math.random() * templates.length)],
    hint: 'Javobingizni pastdagi maydonga yozing va "Javobni tekshirish" tugmasini bosing.',
  };
}

function mockCheck(answer: string) {
  const trimmed = (answer || "").trim();
  const note = " (Eslatma: hozircha oddiy tekshiruv rejimi ishlamoqda — to'liq AI baholash uchun administratordan Gemini API kalitini faollashtirishni so'rang.)";
  if (trimmed.length < 3) {
    return { correct: false, feedback: "Javobingiz juda qisqa ko'rinadi — biroz kengroq yozib ko'ring." + note, corrected: null };
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2) {
    return { correct: false, feedback: "Javobingiz to'liq gap ko'rinishida emas — kamida bitta to'liq gap bilan javob bering." + note, corrected: null };
  }
  if (trimmed.length < 15) return { correct: true, feedback: "Rahmat! Javobingiz qabul qilindi." + note, corrected: null };
  return { correct: true, feedback: "Ajoyib, batafsil javob yozibsiz! Davom eting." + note, corrected: null };
}

/** Gemini javobidan (``` bloklar bo'lishi mumkin bo'lgan) JSON obyektni xavfsiz ajratib oladi. */
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGemini(apiKey: string, prompt: string, jsonMode = false): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body: Record<string, unknown> = { contents: [{ parts: [{ text: prompt }] }] };
  if (jsonMode) body.generationConfig = { responseMimeType: "application/json" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini so'rovi muvaffaqiyatsiz (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join("\n") || "";
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Faqat POST so'rovlar qabul qilinadi" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Kirish talab qilinadi" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "status") {
      const cfg = await getAiConfig(admin);
      return json({ provider: cfg.provider, hasKey: cfg.hasKey, configuredProvider: cfg.configuredProvider });
    }

    if (action === "task") {
      const { type, content, lang } = body;
      if (!content || !lang) return json({ error: "content va lang maydonlari kerak" }, 400);
      const cfg = await getAiConfig(admin);
      if (cfg.provider === "gemini") {
        try {
          const langName = LANG_NAMES[lang] || lang;
          const excerpt = String(content).slice(0, 2500);
          const kind = type === "dialog" ? "dialog" : "matn";
          const prompt = `Sen ${langName}ni o'rganayotgan o'zbek tilida so'zlashuvchi talaba uchun til o'qituvchisisan. Quyidagi ${kind} asosida talabaga bitta qisqa, aniq va bajarilishi mumkin bo'lgan vazifani O'ZBEK TILIDA yoz. Faqat vazifa matnini qaytar, boshqa hech narsa yozma.\n\n${kind === "dialog" ? "Dialog" : "Matn"}:\n"""${excerpt}"""`;
          const question = await callGemini(cfg.apiKey, prompt);
          return json({ question: question || mockTask(type, content, lang).question, hint: 'Javobingizni pastdagi maydonga yozing va "Javobni tekshirish" tugmasini bosing.' });
        } catch (e) {
          console.error("Gemini xatosi, mock rejimiga o'tildi:", e);
        }
      }
      return json(mockTask(type, content, lang));
    }

    if (action === "check") {
      const { context, question, answer, lang } = body;
      if (!answer || !String(answer).trim()) return json({ error: "Javob matni bo'sh bo'lmasligi kerak" }, 400);
      const cfg = await getAiConfig(admin);
      if (cfg.provider === "gemini") {
        try {
          const langName = LANG_NAMES[lang] || lang;
          const prompt = `Sen ${langName}ni o'rganayotgan o'zbek tilida so'zlashuvchi talabaning shaxsiy AI ustozisan — mehribon, aniq va talabchan.\n\nAsl matn/dialog (qisqartirilgan):\n"""${String(context || "").slice(0, 1500)}"""\n\nVazifa: "${question}"\n\nTalabaning javobi: "${answer}"\n\nJavobni diqqat bilan tekshir: u vazifaga mos keladimi, grammatik va mazmun jihatdan to'g'rimi (kichik imlo xatolari yoki ravon bo'lmagan ifoda "noto'g'ri" hisoblanmaydi, lekin mazmun yoki grammatikadagi jiddiy xato "noto'g'ri" hisoblanadi).\n\nFAQAT quyidagi JSON formatida javob qaytar, boshqa hech qanday matn, izoh yoki markdown belgisi qo'shma:\n{"correct": true yoki false, "feedback": "O'ZBEK TILIDA 2-4 gapdan iborat iliq, aniq fikr-mulohaza — nima to'g'ri, nima xato ekanini tushuntir", "corrected": "agar xato bo'lsa, javobning to'g'irlangan/yaxshilangan varianti (${langName}da), aks holda null"}`;
          const raw = await callGemini(cfg.apiKey, prompt, true);
          const parsed = extractJson(raw);
          if (parsed && typeof parsed.feedback === "string") {
            return json({
              correct: Boolean(parsed.correct),
              feedback: parsed.feedback,
              corrected: typeof parsed.corrected === "string" && parsed.corrected.trim() ? parsed.corrected : null,
            });
          }
          // JSON qaytmasa ham, matn feedback sifatida ishlatiladi (eski xatti-harakat, correct=true deb hisoblanadi).
          if (raw) return json({ correct: true, feedback: raw, corrected: null });
        } catch (e) {
          console.error("Gemini xatosi, mock rejimiga o'tildi:", e);
        }
      }
      return json(mockCheck(answer));
    }

    return json({ error: "Noma'lum amal (action)" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
