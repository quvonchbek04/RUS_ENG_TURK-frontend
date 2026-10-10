// Edge Function: /functions/v1/ai — "AI ustoz"
// Har qanday tizimga kirgan foydalanuvchi chaqira oladi. API kalitlar hech qachon
// klientga chiqmaydi: ular api_keys jadvalida saqlanadi va faqat shu funksiya
// ichida (service-role orqali) o'qiladi.
//
// Provayderlar: Gemini (Google), OpenAI, Groq, OpenRouter, DeepSeek va istalgan
// OpenAI-mos API (custom). Bir nechta kalit bo'lsa, biri xato/limit bersa
// avtomatik keyingisiga o'tiladi. Kalit yo'q bo'lsa — oddiy (mock) rejim.
//
// So'rov: POST { action: "status" }
//             { action: "task", type, content, lang, level?, taskKind?, avoid? }
//             { action: "check", context, question, answer, lang, sample? }
//             { action: "chat", messages: [{role, content}], lang, context? }
//             { action: "explain", text, lang }
//             { action: "test-key", id }            (faqat super admin)
//
// Eslatma: fayl ATAYLAB nisbiy importlarsiz — Dashboard orqali ham joylashtiriladi.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LANG_NAMES: Record<string, string> = { ru: "rus tili", en: "ingliz tili", tr: "turk tili" };

const OPENAI_COMPAT: Record<string, { base: string; model: string }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  groq: { base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openrouter/auto" },
  deepseek: { base: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  custom: { base: "", model: "" },
};
// Gemini modeli topilmasa (404) — ketma-ket shu zaxira modellar sinab ko'riladi
const GEMINI_FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

type Msg = { role: "user" | "assistant"; content: string };
type AiRequest = { system: string; messages: Msg[]; json?: boolean; maxTokens?: number; temperature?: number };
type KeyRow = {
  id: number;
  provider: string;
  key_value: string;
  base_url: string | null;
  model: string | null;
  failure_count: number;
  success_count: number;
};
type AiConfig = {
  configured: string;
  provider: string;
  keys: KeyRow[];
  geminiModel: string;
  dailyLimit: number;
  tutorStyle: string;
};
// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError("So'rov vaqti tugadi (timeout)", 504);
    throw new ProviderError(String((e as Error).message || e), 0);
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// SOZLAMALAR
// ---------------------------------------------------------------------------
async function getConfig(admin: Admin): Promise<AiConfig> {
  const { data: rows } = await admin.from("settings").select("key, value").like("key", "ai_%");
  const s: Record<string, string> = {};
  (rows || []).forEach((r: { key: string; value: string }) => (s[r.key] = r.value));
  const configured = (s.ai_provider || "auto").toLowerCase();

  let keys: KeyRow[] = [];
  if (configured !== "mock") {
    let q = admin
      .from("api_keys")
      .select("id, provider, key_value, base_url, model, failure_count, success_count")
      .eq("is_active", true);
    if (configured !== "auto") q = q.eq("provider", configured);
    const { data } = await q
      .order("priority", { ascending: true })
      .order("failure_count", { ascending: true })
      .order("last_used_at", { ascending: true, nullsFirst: true });
    keys = (data || []) as KeyRow[];
  }
  return {
    configured,
    provider: keys.length ? (configured === "auto" ? keys[0].provider : configured) : "mock",
    keys,
    geminiModel: s.ai_model_gemini || "gemini-flash-latest",
    dailyLimit: Number(s.ai_daily_limit ?? 150),
    tutorStyle: s.ai_tutor_style || "",
  };
}

// ---------------------------------------------------------------------------
// PROVAYDERLAR
// ---------------------------------------------------------------------------
/** Xabarlar user bilan boshlanishi va rollar almashinib kelishi uchun tartibga keltiradi. */
function normalizeMessages(messages: Msg[]): Msg[] {
  const out: Msg[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = String(m.content || "").slice(0, 4000);
    if (!content.trim()) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n\n" + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.length ? out : [{ role: "user", content: "Salom" }];
}

async function callGemini(key: KeyRow, cfg: AiConfig, req: AiRequest): Promise<string> {
  const models = [...new Set([key.model, cfg.geminiModel, ...GEMINI_FALLBACK_MODELS].filter(Boolean) as string[])];
  let lastErr: ProviderError | null = null;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: normalizeMessages(req.messages).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: Math.max(1024, req.maxTokens ?? 2048),
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    };
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key.key_value },
        body: JSON.stringify(body),
      },
      40000,
    );
    if (res.status === 404) {
      lastErr = new ProviderError(`Gemini modeli topilmadi: ${model}`, 404);
      continue;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new ProviderError(`Gemini (${res.status}): ${t.slice(0, 280)}`, res.status);
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : p.text || ""))
      .join("")
      .trim();
    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || "noma'lum";
      throw new ProviderError(`Gemini bo'sh javob qaytardi (${reason})`, 502);
    }
    return text;
  }
  throw lastErr || new ProviderError("Gemini modeli topilmadi", 404);
}

async function callOpenAICompat(key: KeyRow, req: AiRequest): Promise<string> {
  const preset = OPENAI_COMPAT[key.provider] || OPENAI_COMPAT.custom;
  const base = String(key.base_url || preset.base).replace(/\/+$/, "");
  const model = key.model || preset.model;
  if (!base || !model) throw new ProviderError("Base URL yoki model ko'rsatilmagan (kalit sozlamasini tekshiring)", 400);

  const payload: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: req.system }, ...normalizeMessages(req.messages)],
  };
  if (key.provider === "openai") {
    payload.max_completion_tokens = req.maxTokens ?? 2048;
  } else {
    payload.max_tokens = req.maxTokens ?? 2048;
    payload.temperature = req.temperature ?? 0.7;
  }
  if (req.json) payload.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key.key_value}`,
  };
  if (key.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://til-sayohati.app";
    headers["X-Title"] = "Til sayohati";
  }

  const send = () =>
    fetchWithTimeout(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(payload) }, 45000);
  let res = await send();
  if (!res.ok && res.status === 400 && payload.response_format) {
    // Ba'zi modellar JSON rejimini qo'llamaydi — rejimsiz qayta urinamiz
    delete payload.response_format;
    res = await send();
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new ProviderError(`${key.provider} (${res.status}): ${t.slice(0, 280)}`, res.status);
  }
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new ProviderError(`${key.provider} bo'sh javob qaytardi`, 502);
  return text;
}

function callKey(key: KeyRow, cfg: AiConfig, req: AiRequest): Promise<string> {
  return key.provider === "gemini" ? callGemini(key, cfg, req) : callOpenAICompat(key, req);
}

/** Kalitlarni navbat bilan sinaydi: biri xato bersa — keyingisiga o'tadi. */
async function runAi(admin: Admin, cfg: AiConfig, req: AiRequest): Promise<string> {
  let lastErr: unknown = null;
  for (const key of cfg.keys) {
    const now = new Date().toISOString();
    try {
      const text = await callKey(key, cfg, req);
      await admin
        .from("api_keys")
        .update({ last_used_at: now, failure_count: 0, last_error: null, success_count: (key.success_count || 0) + 1 })
        .eq("id", key.id);
      return text;
    } catch (e) {
      lastErr = e;
      const status = (e as ProviderError).status || 0;
      const msg = String((e as Error)?.message || e);
      const fails = (key.failure_count || 0) + 1;
      // Faqat yaroqsiz kalit (401/403) 3 marta ketma-ket xato bersa o'chiriladi.
      // Limit (429) xatolarida kalit o'chirilmaydi — ertasi kuni yana ishlaydi.
      const isAuth = status === 401 || status === 403 || /api.?key.*(invalid|not valid)|unauthori[sz]ed/i.test(msg);
      await admin
        .from("api_keys")
        .update({
          failure_count: fails,
          last_error: msg.slice(0, 300),
          last_used_at: now,
          ...(isAuth && fails >= 3 ? { is_active: false } : {}),
        })
        .eq("id", key.id);
      console.warn(`AI kalit #${key.id} (${key.provider}) xato berdi, keyingisi sinab ko'riladi:`, msg);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Faol API kalit topilmadi");
}

/** Model javobidan JSON obyektni xavfsiz ajratib oladi (```json bloklari bo'lsa ham). */
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PROMPTLAR
// ---------------------------------------------------------------------------
// Sayt (interfeys) tili — AI ustoz tushuntirishlarni shu tilda yozadi (standart: o'zbek)
const UI_LANG_NAMES: Record<string, string> = { uz: "o'zbek tili", ru: "rus tili (Русский)", en: "ingliz tili (English)", tr: "turk tili (Türkçe)" };

function tutorSystem(lang: string, cfg: AiConfig, extra = "", ui = "uz"): string {
  const L = LANG_NAMES[lang] || "chet tili";
  return [
    `Sen "Til sayohati" o'quv platformasining AI ustozisan. O'quvchi o'zbek tilida so'zlashadi va ${L}ni o'rganmoqda.`,
    "Qoidalar:",
    "- Tushuntirishlarni o'zbek tilida (lotin yozuvida), sodda va aniq yoz.",
    `- ${L}dagi har bir misolga qavs ichida o'zbekcha tarjima ber.`,
    lang === "ru" ? "- Rus so'zlari yoniga kerak bo'lsa lotincha o'qilishini ham yoz (masalan: спасибо — spasibo)." : "",
    "- Xatolarni muloyim tuzat va nima uchun xato ekanini 1-2 gapda tushuntir.",
    "- Javob ixcham bo'lsin: odatda 3-10 qator. Ro'yxat uchun \"- \", ajratish uchun **qalin** ishlat; boshqa markdown (jadval, sarlavha #) ishlatma.",
    "- O'rinli bo'lsa, oxirida o'quvchiga bitta kichik mashq yoki savol taklif qil.",
    "- Til o'rganishga aloqasi yo'q savollarga juda qisqa javob berib, mavzuga qaytar.",
    cfg.tutorStyle ? `Administrator ko'rsatmasi: ${cfg.tutorStyle}` : "",
    ui !== "uz"
      ? `MUHIM: o'quvchining sayt tili — ${UI_LANG_NAMES[ui] || ui}. Yuqoridagi "o'zbek tilida / o'zbekcha" degan qoidalarni shu tilga almashtir: ` +
        `barcha tushuntirish, tarjima, maslahat va savollarni FAQAT ${UI_LANG_NAMES[ui] || ui}da yoz (o'zbek tilida yozma). JSON javoblarning kalit nomlari o'zgarmaydi.`
      : "",
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

const TASK_KINDS: Record<string, string> = {
  translate: "tarjima (o'zbekchadan o'rganilayotgan tilga yoki aksincha)",
  compose: "berilgan so'z(lar)dan foydalanib gap tuzish",
  fill: "gapdagi bo'sh joyni (___) to'ldirish",
  question: "matn/dialog mazmuni bo'yicha savolga javob berish",
  grammar: "grammatik qoidani qo'llash (shaklini o'zgartirish, to'g'rilash)",
};

function pickSentence(text: string): string {
  const parts = (text || "")
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && s.length < 220);
  if (!parts.length) return (text || "").slice(0, 140);
  return parts[Math.floor(Math.random() * Math.min(parts.length, 12))];
}

// "Oddiy rejim" (AI kalitsiz) matnlari — sayt tilida (uz / ru / en / tr)
const MOCK_TEXT: Record<string, {
  langIn: Record<string, string>; // o'rganilayotgan tilda ("ruscha" ma'nosida)
  translate: (s: string) => string;
  explain: (s: string) => string;
  words: (s: string) => string;
  similar: (L: string, s: string) => string;
  continueDlg: (L: string) => string;
  rewrite: (s: string) => string;
  reply: (L: string) => string;
  hint: string;
  note: string;
  good: string;
  far: string;
  short: string;
  oneSentence: string;
  accepted: string;
  chat: string;
}> = {
  uz: {
    langIn: { ru: "rus tilida", en: "ingliz tilida", tr: "turk tilida" },
    translate: (s) => `Quyidagi jumlani o'zbek tiliga tarjima qiling: "${s}"`,
    explain: (s) => `Ushbu jumla mazmunini o'z so'zlaringiz bilan qisqacha tushuntiring: "${s}"`,
    words: (s) => `Jumladagi kamida 3 ta so'zni ajratib, ma'nosini yozing: "${s}"`,
    similar: (L, s) => `Shu jumlaga o'xshash, lekin o'zingiz haqingizda ${L} bitta gap tuzing: "${s}"`,
    continueDlg: (L) => `Ushbu dialogni davom ettirib, yana 2 ta gap (${L}) yozing.`,
    rewrite: (s) => `Dialogdagi ushbu jumlani boshqacha, lekin shu ma'noda qayta yozing: "${s}"`,
    reply: (L) => `Agar siz suhbatdagi ikkinchi kishi bo'lganingizda, nima deb javob berardingiz? (${L} yozing)`,
    hint: 'Javobingizni pastdagi maydonga yozing va "Tekshirish" tugmasini bosing.',
    note: " (Oddiy tekshiruv rejimi: to'liq AI baholash uchun administrator API kalit qo'shishi kerak.)",
    good: "Yaxshi! Javobingiz namunaga yaqin.",
    far: "Javobingiz namunadan ancha farq qiladi — namunani ko'rib chiqing.",
    short: "Javob juda qisqa — kengroq yozib ko'ring.",
    oneSentence: "Kamida bitta to'liq gap bilan javob bering.",
    accepted: "Javobingiz qabul qilindi. Davom eting!",
    chat: "Hozircha AI ustoz to'liq rejimda ishlamayapti (administrator hali API kalit qo'shmagan). Shunga qaramay, men lug'atdan so'z qidirib bera olaman — so'zni yozing yoki pastdagi tezkor tugmalardan foydalaning.",
  },
  ru: {
    langIn: { ru: "на русском языке", en: "на английском языке", tr: "на турецком языке" },
    translate: (s) => `Переведите следующее предложение на русский язык: "${s}"`,
    explain: (s) => `Кратко объясните смысл этого предложения своими словами: "${s}"`,
    words: (s) => `Выделите в предложении не менее 3 слов и напишите их значение: "${s}"`,
    similar: (L, s) => `Составьте похожее предложение о себе ${L}: "${s}"`,
    continueDlg: (L) => `Продолжите этот диалог, написав ещё 2 реплики (${L}).`,
    rewrite: (s) => `Перепишите эту реплику из диалога иначе, но с тем же смыслом: "${s}"`,
    reply: (L) => `Что бы вы ответили, если бы были вторым участником разговора? (напишите ${L})`,
    hint: 'Напишите ответ в поле ниже и нажмите «Проверить».',
    note: " (Простой режим проверки: для полной оценки ИИ администратор должен добавить API-ключ.)",
    good: "Хорошо! Ваш ответ близок к образцу.",
    far: "Ваш ответ заметно отличается от образца — посмотрите образец.",
    short: "Ответ слишком короткий — напишите подробнее.",
    oneSentence: "Ответьте хотя бы одним полным предложением.",
    accepted: "Ваш ответ принят. Продолжайте!",
    chat: "Пока ИИ-учитель работает не в полном режиме (администратор ещё не добавил API-ключ). Тем не менее я могу найти слово в словаре — напишите слово или воспользуйтесь быстрыми кнопками ниже.",
  },
  en: {
    langIn: { ru: "in Russian", en: "in English", tr: "in Turkish" },
    translate: (s) => `Translate the following sentence into English: "${s}"`,
    explain: (s) => `Briefly explain the meaning of this sentence in your own words: "${s}"`,
    words: (s) => `Pick out at least 3 words from the sentence and write their meanings: "${s}"`,
    similar: (L, s) => `Write a similar sentence about yourself ${L}: "${s}"`,
    continueDlg: (L) => `Continue this dialogue by writing 2 more lines (${L}).`,
    rewrite: (s) => `Rewrite this line of the dialogue differently but with the same meaning: "${s}"`,
    reply: (L) => `What would you say if you were the second person in the conversation? (write ${L})`,
    hint: 'Write your answer in the field below and press “Check”.',
    note: " (Basic checking mode: the administrator needs to add an API key for full AI scoring.)",
    good: "Good! Your answer is close to the sample.",
    far: "Your answer differs a lot from the sample — have a look at the sample.",
    short: "The answer is too short — try to write more.",
    oneSentence: "Please answer with at least one complete sentence.",
    accepted: "Your answer was accepted. Keep going!",
    chat: "The AI tutor is not running in full mode yet (the administrator hasn't added an API key). I can still look words up in the dictionary — type a word or use the quick buttons below.",
  },
  tr: {
    langIn: { ru: "Rusça olarak", en: "İngilizce olarak", tr: "Türkçe olarak" },
    translate: (s) => `Aşağıdaki cümleyi Türkçeye çevirin: "${s}"`,
    explain: (s) => `Bu cümlenin anlamını kendi sözlerinizle kısaca açıklayın: "${s}"`,
    words: (s) => `Cümleden en az 3 kelime seçip anlamlarını yazın: "${s}"`,
    similar: (L, s) => `Buna benzer, kendinizle ilgili bir cümle kurun (${L}): "${s}"`,
    continueDlg: (L) => `Bu diyaloğu 2 cümle daha yazarak sürdürün (${L}).`,
    rewrite: (s) => `Diyalogdaki bu cümleyi farklı ama aynı anlamda yeniden yazın: "${s}"`,
    reply: (L) => `Konuşmadaki ikinci kişi olsaydınız ne cevap verirdiniz? (${L} yazın)`,
    hint: 'Cevabınızı aşağıdaki alana yazın ve «Kontrol et» düğmesine basın.',
    note: " (Basit kontrol modu: tam YZ puanlaması için yöneticinin bir API anahtarı eklemesi gerekir.)",
    good: "İyi! Cevabınız örneğe yakın.",
    far: "Cevabınız örnekten oldukça farklı — örneğe bakın.",
    short: "Cevap çok kısa — daha ayrıntılı yazmayı deneyin.",
    oneSentence: "En az bir tam cümleyle cevap verin.",
    accepted: "Cevabınız kabul edildi. Devam edin!",
    chat: "YZ öğretmen henüz tam modda çalışmıyor (yönetici henüz API anahtarı eklemedi). Yine de sözlükte kelime arayabilirim — bir kelime yazın veya aşağıdaki hızlı düğmeleri kullanın.",
  },
};

function mockTask(type: string, content: string, lang: string, ui = "uz") {
  const M = MOCK_TEXT[ui] || MOCK_TEXT.uz;
  const L = M.langIn[lang] || lang;
  const sentence = pickSentence(content);
  const textTemplates = [M.translate(sentence), M.explain(sentence), M.words(sentence), M.similar(L, sentence)];
  const dialogTemplates = [M.continueDlg(L), M.rewrite(sentence), M.reply(L)];
  const templates = type === "dialog" ? dialogTemplates : textTemplates;
  return {
    question: templates[Math.floor(Math.random() * templates.length)],
    hint: M.hint,
    sample: null,
    mock: true,
  };
}

function tokens(s: string) {
  return String(s || "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function mockCheck(answer: string, sample?: string | null, ui = "uz") {
  const M = MOCK_TEXT[ui] || MOCK_TEXT.uz;
  const note = M.note;
  const trimmed = (answer || "").trim();
  if (sample) {
    const a = new Set(tokens(trimmed));
    const b = tokens(sample);
    const hit = b.filter((w) => a.has(w)).length;
    const ratio = b.length ? hit / b.length : 0;
    const score = Math.round(ratio * 100);
    return {
      correct: ratio >= 0.6,
      score,
      feedback: (ratio >= 0.6 ? M.good : M.far) + note,
      corrected: ratio >= 0.6 ? null : sample,
      tips: [],
      mock: true,
    };
  }
  if (trimmed.length < 3) {
    return { correct: false, score: 10, feedback: M.short + note, corrected: null, tips: [], mock: true };
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2) {
    return { correct: false, score: 30, feedback: M.oneSentence + note, corrected: null, tips: [], mock: true };
  }
  return { correct: true, score: 70, feedback: M.accepted + note, corrected: null, tips: [], mock: true };
}

// ---------------------------------------------------------------------------
// ASOSIY HANDLER
// ---------------------------------------------------------------------------
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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: profile } = await admin.from("profiles").select("role, is_blocked").eq("id", user.id).single();
    if (profile?.is_blocked) return json({ error: "Hisobingiz bloklangan" }, 403);
    const isStaff = profile?.role === "admin" || profile?.role === "superadmin";

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const lang = String(body.lang || "en");
    const L = LANG_NAMES[lang] || "chet tili";
    const ui = ["uz", "ru", "en", "tr"].includes(String(body.ui)) ? String(body.ui) : "uz";
    const UIN = UI_LANG_NAMES[ui];
    const cfg = await getConfig(admin);

    /** Kunlik limitni tekshiradi va hisoblagichni oshiradi (adminlar uchun cheklov yo'q, 0 = cheksiz). */
    async function consumeQuota(): Promise<Response | null> {
      if (cfg.provider === "mock" || isStaff || cfg.dailyLimit <= 0) return null;
      const { data, error } = await admin.rpc("bump_ai_usage", { p_user: user!.id });
      if (error) return null;
      if (Number(data) > cfg.dailyLimit) {
        return json({ error: `Bugungi AI so'rovlar limiti (${cfg.dailyLimit} ta) tugadi. Ertaga yana urinib ko'ring.`, limit: true }, 429);
      }
      return null;
    }

    // ---------- holat ----------
    if (action === "status") {
      const providers = [...new Set(cfg.keys.map((k) => k.provider))];
      let usedToday = 0;
      const { data: usage } = await admin
        .from("ai_usage")
        .select("count")
        .eq("user_id", user.id)
        .eq("day", new Date().toISOString().slice(0, 10))
        .maybeSingle();
      usedToday = (usage?.count as number) || 0;
      return json({
        provider: cfg.provider,
        configuredProvider: cfg.configured,
        hasKey: cfg.keys.length > 0,
        activeKeyCount: cfg.keys.length,
        providers,
        dailyLimit: isStaff ? 0 : cfg.dailyLimit,
        usedToday,
      });
    }

    // ---------- kalitni sinash (admin) ----------
    if (action === "test-key") {
      if (profile?.role !== "superadmin") return json({ error: "Bu amal uchun ruxsatingiz yo'q" }, 403);
      const { data: key } = await admin
        .from("api_keys")
        .select("id, provider, key_value, base_url, model, failure_count, success_count")
        .eq("id", body.id)
        .single();
      if (!key) return json({ error: "Kalit topilmadi" }, 404);
      const started = Date.now();
      try {
        const text = await callKey(key as KeyRow, cfg, {
          system: "Sen qisqa javob beruvchi test yordamchisisan.",
          messages: [{ role: "user", content: "Faqat bitta so'z bilan javob ber: OK" }],
          maxTokens: 1024,
          temperature: 0,
        });
        await admin
          .from("api_keys")
          .update({ failure_count: 0, last_error: null, last_used_at: new Date().toISOString() })
          .eq("id", key.id);
        return json({ ok: true, latencyMs: Date.now() - started, sample: text.slice(0, 80) });
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        await admin.from("api_keys").update({ last_error: msg.slice(0, 300) }).eq("id", key.id);
        return json({ ok: false, latencyMs: Date.now() - started, error: msg });
      }
    }

    // ---------- vazifa berish ----------
    if (action === "task") {
      const { type, content } = body;
      if (!content) return json({ error: "content maydoni kerak" }, 400);
      if (cfg.provider !== "mock") {
        const limited = await consumeQuota();
        if (limited) return limited;
        try {
          const kindKey = TASK_KINDS[body.taskKind] ? body.taskKind : null;
          const kind = kindKey ? TASK_KINDS[kindKey] : "material uchun eng mos turini o'zing tanla";
          const level = String(body.level || "A1-A2");
          const avoid = Array.isArray(body.avoid) && body.avoid.length
            ? `\nQuyidagi vazifalarni TAKRORLAMA:\n${body.avoid.slice(-5).map((q: string) => "- " + String(q).slice(0, 160)).join("\n")}`
            : "";
          const prompt =
            `Quyidagi o'quv materiali (${type === "dialog" ? "dialog" : "matn"}) asosida o'quvchiga BITTA qisqa, aniq va bajarsa bo'ladigan vazifa tuz.\n` +
            `Vazifa turi: ${kind}. O'quvchi darajasi: ${level}.${avoid}\n\n` +
            `Material:\n"""${String(content).slice(0, 3000)}"""\n\n` +
            `FAQAT shu JSON formatida javob qaytar: {"question": "vazifa matni ${UIN}da (kerakli ${L}dagi so'z yoki gaplar bilan)", ` +
            `"hint": "${UIN}da qisqa maslahat", "sample": "namunaviy to'g'ri javob"}`;
          const raw = await runAi(admin, cfg, {
            system: tutorSystem(lang, cfg, "", ui),
            messages: [{ role: "user", content: prompt }],
            json: true,
            temperature: 0.9,
          });
          const parsed = extractJson(raw);
          if (parsed && typeof parsed.question === "string" && parsed.question.trim()) {
            return json({
              question: parsed.question,
              hint: typeof parsed.hint === "string" ? parsed.hint : "",
              sample: typeof parsed.sample === "string" ? parsed.sample : null,
            });
          }
          if (raw) return json({ question: raw, hint: "", sample: null });
        } catch (e) {
          console.error("AI xatosi, oddiy rejimga o'tildi:", e);
        }
      }
      return json(mockTask(type, String(content), lang, ui));
    }

    // ---------- javobni tekshirish ----------
    if (action === "check") {
      const { context, question, answer, sample } = body;
      if (!answer || !String(answer).trim()) return json({ error: "Javob matni bo'sh bo'lmasligi kerak" }, 400);
      if (cfg.provider !== "mock") {
        const limited = await consumeQuota();
        if (limited) return limited;
        try {
          const prompt =
            `Asl material (qisqartirilgan):\n"""${String(context || "").slice(0, 1800)}"""\n\n` +
            `Vazifa: "${String(question || "").slice(0, 600)}"\n` +
            (sample ? `Namunaviy javob (yo'l-yo'riq uchun, yagona to'g'ri variant emas): "${String(sample).slice(0, 400)}"\n` : "") +
            `O'quvchining javobi: "${String(answer).slice(0, 1500)}"\n\n` +
            "Javobni tekshir: vazifaga mosmi, grammatika va mazmun to'g'rimi. Kichik imlo xatosi yoki noodatiy, lekin to'g'ri ifoda " +
            "\"noto'g'ri\" hisoblanmaydi; mazmun yoki grammatikadagi jiddiy xato esa noto'g'ri.\n\n" +
            'FAQAT shu JSON formatida javob qaytar: {"correct": true/false, "score": 0-100 oralig\'idagi butun son, ' +
            `"feedback": "${UIN}da 2-4 gapli iliq va aniq izoh: nima to'g'ri, nima xato", ` +
            `"corrected": "xato bo'lsa to'g'rilangan variant (${L}da), aks holda null", ` +
            `"tips": ["1-3 ta qisqa maslahat (${UIN}da)"]}`;
          const raw = await runAi(admin, cfg, {
            system: tutorSystem(lang, cfg, "", ui),
            messages: [{ role: "user", content: prompt }],
            json: true,
            temperature: 0.3,
          });
          const parsed = extractJson(raw);
          if (parsed && typeof parsed.feedback === "string") {
            const score = Math.max(0, Math.min(100, Number(parsed.score ?? (parsed.correct ? 85 : 40)) || 0));
            return json({
              correct: Boolean(parsed.correct),
              score,
              feedback: parsed.feedback,
              corrected: typeof parsed.corrected === "string" && parsed.corrected.trim() && parsed.corrected !== "null" ? parsed.corrected : null,
              tips: Array.isArray(parsed.tips) ? parsed.tips.filter((t) => typeof t === "string").slice(0, 3) : [],
            });
          }
          if (raw) return json({ correct: true, score: 70, feedback: raw, corrected: null, tips: [] });
        } catch (e) {
          console.error("AI xatosi, oddiy rejimga o'tildi:", e);
        }
      }
      return json(mockCheck(String(answer), sample ? String(sample) : null, ui));
    }

    // ---------- erkin suhbat (AI ustoz chat) ----------
    if (action === "chat") {
      const history: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
      if (!history.length) return json({ error: "Xabar bo'sh" }, 400);
      if (cfg.provider === "mock") {
        return json({
          mock: true,
          reply: (MOCK_TEXT[ui] || MOCK_TEXT.uz).chat,
        });
      }
      const limited = await consumeQuota();
      if (limited) return limited;
      const ctx = body.context && typeof body.context === "object" ? body.context : null;
      const extra = ctx
        ? `\nO'quvchi hozir shu material ustida ishlayapti — savollar shunga tegishli bo'lishi mumkin:\nMavzu: ${String(ctx.title || "").slice(0, 200)}\n"""${String(ctx.text || "").slice(0, 2500)}"""`
        : "";
      try {
        const reply = await runAi(admin, cfg, { system: tutorSystem(lang, cfg, extra, ui), messages: history, temperature: 0.7 });
        return json({ reply });
      } catch (e) {
        console.error("AI chat xatosi:", e);
        return json({ error: "AI ustoz hozir javob bera olmadi. Birozdan keyin qayta urinib ko'ring." }, 502);
      }
    }

    // ---------- so'z / gapni tushuntirish ----------
    if (action === "explain") {
      const text = String(body.text || "").trim().slice(0, 500);
      if (!text) return json({ error: "Matn kerak" }, 400);
      if (cfg.provider === "mock") return json({ mock: true, reply: null });
      const limited = await consumeQuota();
      if (limited) return limited;
      try {
        const reply = await runAi(admin, cfg, {
          system: tutorSystem(lang, cfg, "", ui),
          messages: [{
            role: "user",
            content:
              `"${text}" (${L}) ni tushuntirib ber (${UIN}da): tarjimasi, o'qilishi (lotin harflarida), so'z turkumi yoki grammatik tuzilishi, ` +
              "ma'no nozikliklari, tarjimasi bilan 2-3 ta misol gap va eslab qolish uchun bitta maslahat.",
          }],
          temperature: 0.5,
        });
        return json({ reply });
      } catch (e) {
        console.error("AI explain xatosi:", e);
        return json({ error: "AI hozir javob bera olmadi" }, 502);
      }
    }

    return json({ error: "Noma'lum amal (action)" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
