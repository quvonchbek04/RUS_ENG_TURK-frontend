// Edge Function: /functions/v1/admin
// Admin / super admin amallari: foydalanuvchi va admin qo'shish/o'chirish, rol
// berish, parolni tiklash, bloklash, AI sozlamalari va API kalitlarni boshqarish.
// Bular Auth Admin API yoki maxfiy jadvallarga (api_keys) kirishni talab qilgani
// uchun klientdan emas, shu funksiya orqali (service-role kalit bilan) bajariladi.
//
// So'rov: POST { action, ...payload }   Header: Authorization: Bearer <sessiya tokeni>
// Ochiq (tokensiz) amallar: "login" (email/telefon/login + parol), "send-email-code" (emailga 6 xonali kod),
// "register" (email — kod bilan tasdiqlanadi (super admin o'chirib qo'ysa — kodsiz), telefon — kodsiz),
// "reset-with-code" (parolni kod bilan tiklash — email yoki Telegram), "signup-config" (ro'yxatdan o'tish rejimi: kod kerakmi),
// "tg-start" / "tg-status" / "tg-reset-start" (Telegram bot: telefon tasdiqlash, bot orqali ro'yxatdan o'tish, parolni tiklash).
// Adminlarning funksiya ruxsatlari (profiles.permissions) shu yerda majburlanadi; super admin ma'lumotlari boshqalarga qaytarilmaydi.
//
// Eslatma: fayl ATAYLAB hech qanday nisbiy importga ega emas — Supabase
// Dashboard'dagi muharrir orqali (CLI'siz) joylashtirilganda ham ishlaydi.

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

const SYNTH_DOMAIN = "til-sayohati.app";
const PROVIDERS = ["gemini", "openai", "groq", "openrouter", "deepseek", "custom"];
const PROVIDER_MODES = ["auto", "mock", ...PROVIDERS];
// Yuklanadigan material turlari (media_items.kind bilan bir xil). Adminlarga ruxsat shu turlar bo'yicha beriladi.
const MEDIA_KINDS = ["audio", "video", "image", "text", "dialog", "vocab", "news"];
// Adminga beriladigan funksiya ruxsatlari (faqat o'quvchilar ustida / ko'rish). Super admin hammasiga ega.
// Adminlarni boshqarish, rol berish va sozlamalar (ro'yxatdan o'tish, AI, email, Telegram) — faqat super admin, ruxsat berib bo'lmaydi.
const FUNC_PERMS = ["users_view", "users_add", "users_block", "users_reset", "users_delete", "ai_view", "mail_view", "stats_view"];
const DEFAULT_ADMIN_PERMS = ["ai_view", "mail_view", "stats_view"];

type Profile = Record<string, unknown>;

function publicUser(p: Profile, extra: Record<string, unknown> = {}) {
  return {
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    role: p.role,
    email: p.email,
    phone: p.phone,
    isBlocked: p.is_blocked,
    uploadKinds: (p.upload_kinds as string[] | null | undefined) || [],
    permissions: (p.permissions as string[] | null | undefined) || [],
    lastSeenAt: p.last_seen_at,
    createdAt: p.created_at,
    ...extra,
  };
}

/** Funksiya ruxsatlari ro'yxatini tekshiradi: faqat ma'lum ruxsatlar, takrorsiz, standart tartibda. Noto'g'ri bo'lsa — null. */
function sanitizePerms(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const given = [...new Set(v.map((x) => String(x)))];
  if (!given.every((k) => FUNC_PERMS.includes(k))) return null;
  return FUNC_PERMS.filter((k) => given.includes(k));
}

/** Ruxsat ro'yxatini tekshiradi: faqat ma'lum turlar, takrorsiz, standart tartibda. Noto'g'ri bo'lsa — null. */
function sanitizeKinds(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const given = [...new Set(v.map((x) => String(x)))];
  if (!given.every((k) => MEDIA_KINDS.includes(k))) return null;
  return MEDIA_KINDS.filter((k) => given.includes(k));
}

/** Telefonni faqat raqamlarga keltiradi; 9 xonali O'zbekiston raqamiga 998 qo'shadi. */
function normalizePhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/** Login maydoni: email, telefon yoki oddiy login → Supabase Auth email'i. */
function resolveIdentifier(input: string) {
  const s = String(input || "").trim();
  if (!s) return null;
  if (s.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
    return { kind: "email", email: s.toLowerCase(), username: s.split("@")[0], phone: null as string | null };
  }
  if (/^\+?[\d\s\-()]{9,}$/.test(s)) {
    const d = normalizePhone(s);
    if (!d) return null;
    return { kind: "phone", email: `tel${d}@${SYNTH_DOMAIN}`, username: d, phone: "+" + d };
  }
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(s)) return null;
  return { kind: "username", email: `${s.toLowerCase()}@${SYNTH_DOMAIN}`, username: s, phone: null as string | null };
}

function maskKey(v: string) {
  if (!v) return "";
  return v.length <= 12 ? "••••" + v.slice(-3) : `${v.slice(0, 6)}••••${v.slice(-4)}`;
}

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

// ---------------------------------------------------------------------------
// EMAIL TASDIQLASH KODLARI (6 xonali, 10 daqiqa, 5 urinish)
// ---------------------------------------------------------------------------
const CODE_TTL_MS = 10 * 60_000;
const CODE_MAX_ATTEMPTS = 5;
const CODE_COOLDOWN_MS = 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PURPOSES = ["register", "reset", "change-email"];

function normEmail(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function clientIp(req: Request): string {
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 64);
}

async function hmacHex(text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1_000_000).padStart(6, "0");
}

/** Oynada `max` martadan ko'p chaqirilsa false qaytaradi (kod yuborishdan suiste'mol qilishdan himoya). */
async function allow(admin: Admin, key: string, max: number, windowMs: number): Promise<boolean> {
  const { data: row } = await admin.from("login_attempts").select("*").eq("key", key).maybeSingle();
  const now = Date.now();
  const fresh = !row || now - new Date(row.window_start as string).getTime() > windowMs;
  if (!fresh && ((row!.fails as number) || 0) >= max) return false;
  await admin.from("login_attempts").upsert({
    key,
    fails: fresh ? 1 : ((row!.fails as number) || 0) + 1,
    window_start: fresh ? new Date(now).toISOString() : row!.window_start,
    locked_until: null,
  });
  return true;
}

type MailCfg = { provider: string; apiKey: string; from: string; fromName: string };

async function getMailConfig(admin: Admin): Promise<MailCfg> {
  const { data } = await admin.from("secure_settings").select("key, value").in("key", ["mail_provider", "mail_api_key", "mail_from", "mail_from_name"]);
  const m: Record<string, string> = {};
  (data || []).forEach((r: { key: string; value: string }) => (m[r.key] = r.value));
  return {
    provider: (m.mail_provider || "brevo").toLowerCase(),
    apiKey: m.mail_api_key || "",
    from: m.mail_from || "",
    fromName: m.mail_from_name || "Til sayohati",
  };
}

async function sendMail(cfg: MailCfg, to: string, subject: string, html: string, text: string): Promise<void> {
  if (!cfg.apiKey || !cfg.from) throw new Error("Email xizmati sozlanmagan");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res =
      cfg.provider === "resend"
        ? await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: `${cfg.fromName} <${cfg.from}>`, to: [to], subject, html, text }),
            signal: ctrl.signal,
          })
        : await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": cfg.apiKey, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ sender: { name: cfg.fromName, email: cfg.from }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
            signal: ctrl.signal,
          });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${cfg.provider} (${res.status}): ${t.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Ro'yxatdan o'tishda (va emailni almashtirishda) emailga yuborilgan kod talab qilinadimi?
 *  Super admin panelidan boshqariladi; sozlama bo'lmasa — talab qilinadi (xavfsizroq standart). */
async function getSignupEmailCode(admin: Admin): Promise<boolean> {
  return (await getSignupCfg(admin)).emailCode;
}

// ---------------------------------------------------------------------------
// RO'YXATDAN O'TISH USULLARI (super admin belgilaydi) va TELEGRAM
// ---------------------------------------------------------------------------
type SignupCfg = {
  login: boolean; // oddiy usul: ism + login + parol
  email: boolean; // email bilan
  phone: boolean; // telefon bilan
  emailCode: boolean; // email kodi talab qilinadimi
  phoneTelegram: boolean; // telefon Telegram bot orqali tasdiqlanadimi
  telegram: boolean; // Telegram bot orqali ro'yxatdan o'tish (alohida usul, kod yozmasdan)
  tgToken: string;
  tgBot: string;
  tgSecret: string;
};

const SIGNUP_KEYS = ["reg_login", "reg_email", "reg_phone", "reg_telegram", "signup_email_code", "signup_phone_telegram", "tg_bot_token", "tg_bot_username", "tg_webhook_secret"];

async function getSignupCfg(admin: Admin): Promise<SignupCfg> {
  const { data } = await admin.from("secure_settings").select("key, value").in("key", SIGNUP_KEYS);
  const m: Record<string, string> = {};
  (data || []).forEach((r: { key: string; value: string }) => (m[r.key] = r.value));
  // Sozlama bo'sh/yo'q bo'lsa — standart qiymat; "off" bo'lsa — o'chiq
  const isOn = (k: string, def: boolean) => (m[k] === undefined || m[k] === null || m[k] === "" ? def : String(m[k]).toLowerCase() !== "off");
  return {
    login: isOn("reg_login", true),
    email: isOn("reg_email", true),
    phone: isOn("reg_phone", true),
    emailCode: isOn("signup_email_code", true),
    phoneTelegram: String(m.signup_phone_telegram || "").toLowerCase() === "on",
    telegram: String(m.reg_telegram || "").toLowerCase() === "on",
    tgToken: m.tg_bot_token || "",
    tgBot: m.tg_bot_username || "",
    tgSecret: m.tg_webhook_secret || "",
  };
}

const tgReady = (c: SignupCfg) => !!(c.tgToken && c.tgBot && c.tgSecret);

/** Telegram tasdiqlash amalda yoqilgan va bot to'liq sozlanganmi. */
const tgActive = (c: SignupCfg) => c.phoneTelegram && tgReady(c);

/** Telegram bot orqali ro'yxatdan o'tish usuli amalda yoqilganmi. */
const tgRegActive = (c: SignupCfg) => c.telegram && tgReady(c);

function maskPhone(d: string): string {
  return d.length > 5 ? `+${d.slice(0, 3)} ${"•".repeat(d.length - 5)}${d.slice(-2)}` : `+${d}`;
}

function randomToken(bytes = 18): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const TG_API = "https://api.telegram.org";

async function tgCall(token: string, method: string, payload: Record<string, unknown> = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${TG_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.description || `Telegram xatosi (${res.status})`);
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

// Bot xabarlari foydalanuvchining Telegram tilida (uz / ru / en / tr)
const TG_TEXT: Record<string, Record<string, string>> = {
  uz: {
    welcome: "👋 Salom! Men «Til sayohati» saytida ro'yxatdan o'tish va telefon raqamini tasdiqlashga yordam beradigan botman.\n\nSaytdagi ro'yxatdan o'tish sahifasida «Telegram bot orqali ro'yxatdan o'tish» yoki «Telegramni ochish» tugmasini bosing — havola meni shu yerga olib keladi.",
    verified: "✅ Raqamingiz tasdiqlandi!\n\nEndi saytga qayting — ro'yxatdan o'tish shu yerda davom etadi (ism va parol kiritasiz).",
    codeOnly: "🔐 «Til sayohati» tasdiqlash kodi: <code>{code}</code>\n\nKodni saytga kiriting. U 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, e'tibor bermang va kodni hech kimga bermang.",
    resetCode: "🔑 «Til sayohati» parolni tiklash kodi: <code>{code}</code>\n\nKodni saytga kiriting. U 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, e'tibor bermang va kodni hech kimga bermang.",
    expired: "⌛ Havola eskirgan yoki noto'g'ri. Saytga qaytib, «Qaytadan boshlash» yoki «Telegramni ochish» tugmasini qayta bosing.",
    askContact: "📱 Raqamingizni tasdiqlash uchun pastdagi «Raqamni ulashish» tugmasini bosing.",
    share: "📱 Raqamni ulashish",
    ownOnly: "Iltimos, faqat o'zingizning raqamingizni (pastdagi tugma orqali) ulashing.",
    mismatch: "❌ Ulashilgan raqam saytda kiritilgan raqamga ({phone}) mos kelmadi. Saytda to'g'ri raqamni kiriting va qayta urinib ko'ring.",
    noRequest: "Faol so'rov topilmadi. Saytda «Telegramni ochish» tugmasini bosib, havola orqali keling.",
    code: "✅ Raqamingiz tasdiqlandi!\n\nTasdiqlash kodi: <code>{code}</code>\n\nKodni saytga kiriting. U 10 daqiqa amal qiladi. Kodni hech kimga bermang.",
    help: "Kod olish uchun saytdagi «Telegramni ochish» tugmasidan foydalaning.",
  },
  ru: {
    welcome: "👋 Здравствуйте! Я бот, который помогает с регистрацией и подтверждением номера телефона на сайте «Til sayohati».\n\nНа странице регистрации нажмите «Регистрация через Telegram-бота» или «Открыть Telegram» — ссылка приведёт вас сюда.",
    verified: "✅ Номер подтверждён!\n\nТеперь вернитесь на сайт — регистрация продолжится там (введёте имя и пароль).",
    codeOnly: "🔐 Код подтверждения «Til sayohati»: <code>{code}</code>\n\nВведите код на сайте. Он действует 10 минут. Если вы его не запрашивали, проигнорируйте сообщение и никому не сообщайте код.",
    resetCode: "🔑 Код для восстановления пароля «Til sayohati»: <code>{code}</code>\n\nВведите код на сайте. Он действует 10 минут. Если вы его не запрашивали, проигнорируйте сообщение и никому не сообщайте код.",
    expired: "⌛ Ссылка устарела или неверна. Вернитесь на сайт и снова нажмите «Начать заново» или «Открыть Telegram».",
    askContact: "📱 Чтобы подтвердить номер, нажмите кнопку «Поделиться номером» ниже.",
    share: "📱 Поделиться номером",
    ownOnly: "Пожалуйста, поделитесь только своим номером (кнопкой ниже).",
    mismatch: "❌ Номер не совпадает с номером, указанным на сайте ({phone}). Укажите на сайте правильный номер и попробуйте снова.",
    noRequest: "Активный запрос не найден. Нажмите на сайте «Открыть Telegram» и перейдите по ссылке.",
    code: "✅ Номер подтверждён!\n\nКод подтверждения: <code>{code}</code>\n\nВведите код на сайте. Он действует 10 минут. Никому не сообщайте код.",
    help: "Чтобы получить код, используйте кнопку «Открыть Telegram» на сайте.",
  },
  en: {
    welcome: "👋 Hello! I'm the bot that helps with sign-up and phone verification on the “Til sayohati” website.\n\nOn the sign-up page press “Sign up with the Telegram bot” or “Open Telegram” — the link will bring you here.",
    verified: "✅ Your number is verified!\n\nNow go back to the website — sign-up continues there (you'll enter a name and a password).",
    codeOnly: "🔐 “Til sayohati” verification code: <code>{code}</code>\n\nEnter the code on the website. It is valid for 10 minutes. If you didn't request it, ignore this message and never share the code.",
    resetCode: "🔑 “Til sayohati” password recovery code: <code>{code}</code>\n\nEnter the code on the website. It is valid for 10 minutes. If you didn't request it, ignore this message and never share the code.",
    expired: "⌛ This link has expired or is invalid. Go back to the website and press “Start over” or “Open Telegram” again.",
    askContact: "📱 To verify your number, press the “Share number” button below.",
    share: "📱 Share number",
    ownOnly: "Please share only your own number (with the button below).",
    mismatch: "❌ The shared number doesn't match the number entered on the website ({phone}). Enter the correct number on the website and try again.",
    noRequest: "No active request found. Press “Open Telegram” on the website and come here via the link.",
    code: "✅ Your number is verified!\n\nVerification code: <code>{code}</code>\n\nEnter the code on the website. It is valid for 10 minutes. Never share it with anyone.",
    help: "To get a code, use the “Open Telegram” button on the website.",
  },
  tr: {
    welcome: "👋 Merhaba! Ben «Til sayohati» sitesinde kayıt ve telefon doğrulamaya yardım eden botum.\n\nKayıt sayfasında «Telegram botuyla kayıt ol» veya «Telegram'ı aç» düğmesine basın — bağlantı sizi buraya getirecek.",
    verified: "✅ Numaranız doğrulandı!\n\nŞimdi siteye dönün — kayıt orada devam eder (ad ve parola girersiniz).",
    codeOnly: "🔐 «Til sayohati» doğrulama kodu: <code>{code}</code>\n\nKodu sitede girin. 10 dakika geçerlidir. Siz istemediyseniz bu mesajı yok sayın ve kodu kimseyle paylaşmayın.",
    resetCode: "🔑 «Til sayohati» parola kurtarma kodu: <code>{code}</code>\n\nKodu sitede girin. 10 dakika geçerlidir. Siz istemediyseniz bu mesajı yok sayın ve kodu kimseyle paylaşmayın.",
    expired: "⌛ Bağlantının süresi dolmuş veya geçersiz. Siteye dönüp «Baştan başla» veya «Telegram'ı aç» düğmesine yeniden basın.",
    askContact: "📱 Numaranızı doğrulamak için aşağıdaki «Numarayı paylaş» düğmesine basın.",
    share: "📱 Numarayı paylaş",
    ownOnly: "Lütfen yalnızca kendi numaranızı (aşağıdaki düğmeyle) paylaşın.",
    mismatch: "❌ Paylaşılan numara sitede girilen numarayla ({phone}) eşleşmedi. Sitede doğru numarayı girip tekrar deneyin.",
    noRequest: "Etkin istek bulunamadı. Sitede «Telegram'ı aç» düğmesine basıp bağlantıyla gelin.",
    code: "✅ Numaranız doğrulandı!\n\nDoğrulama kodu: <code>{code}</code>\n\nKodu sitede girin. 10 dakika geçerlidir. Kodu kimseyle paylaşmayın.",
    help: "Kod almak için sitedeki «Telegram'ı aç» düğmesini kullanın.",
  },
};

function tgLangOf(code?: string): string {
  const c = String(code || "").slice(0, 2).toLowerCase();
  return TG_TEXT[c] ? c : "uz";
}

/** Telegram'dan kelgan yangilanishni qayta ishlaydi: /start <token> → kontakt so'rash → kontakt mos bo'lsa kod yuborish. */
// deno-lint-ignore no-explicit-any
async function processTgUpdate(admin: Admin, cfg: SignupCfg, update: any) {
  const msg = update?.message;
  if (!msg?.chat || msg.chat.type !== "private" || !msg.from || msg.from.is_bot) return;
  const chatId = msg.chat.id as number;
  const fromId = msg.from.id as number;
  const L = TG_TEXT[tgLangOf(msg.from.language_code)];
  const send = (text: string, markup?: unknown) =>
    tgCall(cfg.tgToken, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...(markup ? { reply_markup: markup } : {}) });

  if (typeof msg.text === "string" && msg.text.startsWith("/start")) {
    const arg = msg.text.trim().split(/\s+/)[1] || "";
    if (!arg) {
      await send(L.welcome);
      return;
    }
    const { data: row } = await admin.from("tg_verifications").select("token, expires_at").eq("token", arg).maybeSingle();
    if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
      await send(L.expired);
      return;
    }
    await admin.from("tg_verifications").update({ tg_user_id: fromId, chat_id: chatId, status: "await_contact" }).eq("token", arg);
    await send(L.askContact, { keyboard: [[{ text: L.share, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
    return;
  }

  if (msg.contact) {
    const { data: rows } = await admin
      .from("tg_verifications")
      .select("*")
      .eq("tg_user_id", fromId)
      .in("status", ["await_contact", "code_sent"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) {
      await send(L.noRequest, { remove_keyboard: true });
      return;
    }
    // Faqat foydalanuvchining O'Z kontakti qabul qilinadi (boshqaning raqamini yuborib bo'lmaydi)
    if (msg.contact.user_id !== fromId) {
      await send(L.ownOnly);
      return;
    }
    const d = normalizePhone(String(msg.contact.phone_number || ""));
    if (!d) {
      await send(L.ownOnly);
      return;
    }
    // Raqam egasi tasdiqlandi — keyingi safar (raqam yozilganda) kod to'g'ridan-to'g'ri shu chatga yuboriladi
    await admin.from("tg_contacts").upsert({ phone: d, tg_user_id: fromId, chat_id: chatId, lang: tgLangOf(msg.from.language_code), updated_at: new Date().toISOString() });
    // Telegram orqali ro'yxatdan o'tish: raqam kontaktdan olinadi, kod kerak emas — sayt holatni so'rab turadi
    if (row.purpose === "register-tg") {
      await admin
        .from("tg_verifications")
        .update({ phone: d, status: "verified", expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() })
        .eq("token", row.token);
      await send(L.verified, { remove_keyboard: true });
      return;
    }
    if (d !== row.phone) {
      await send(L.mismatch.replace("{phone}", "+" + row.phone), { remove_keyboard: true });
      return;
    }
    const code = randomCode();
    await admin
      .from("tg_verifications")
      .update({
        code_hash: await hmacHex(`${row.token}|${row.phone}|${code}`),
        status: "code_sent",
        attempts: 0,
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      })
      .eq("token", row.token);
    await send(L.code.replace("{code}", code), { remove_keyboard: true });
    return;
  }

  await send(L.help);
}

/** Raqam avval bot orqali tasdiqlangan bo'lsa (tg_contacts) — kodni DARHOL shu Telegram chatiga yuboradi va so'rov tokenini qaytaradi.
 *  Bog'lanmagan bo'lsa yoki yuborib bo'lmasa (bot bloklangan) — null (foydalanuvchi bot havolasi orqali o'tadi). */
async function sendCodeToLinked(admin: Admin, cfg: SignupCfg, phone: string, purpose: string, userId: string | null): Promise<string | null> {
  const { data: c } = await admin.from("tg_contacts").select("tg_user_id, chat_id, lang").eq("phone", phone).maybeSingle();
  if (!c) return null;
  const token = randomToken(18);
  const code = randomCode();
  await admin.from("tg_verifications").delete().eq("phone", phone).eq("purpose", purpose);
  const { error } = await admin.from("tg_verifications").insert({
    token,
    phone,
    purpose,
    user_id: userId,
    tg_user_id: c.tg_user_id,
    chat_id: c.chat_id,
    status: "code_sent",
    code_hash: await hmacHex(`${token}|${phone}|${code}`),
    attempts: 0,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) return null;
  const L = TG_TEXT[tgLangOf(c.lang as string)];
  try {
    await tgCall(cfg.tgToken, "sendMessage", { chat_id: c.chat_id, text: (purpose === "reset" ? L.resetCode : L.codeOnly).replace("{code}", code), parse_mode: "HTML" });
  } catch (e) {
    console.error("Telegramga kod yuborilmadi:", (e as Error).message);
    await admin.from("tg_verifications").delete().eq("token", token);
    return null;
  }
  return token;
}

/** Telegram kodini tekshiradi. consume=true bo'lsa to'g'ri kod bir martalik — so'rov o'chiriladi. Xato bo'lsa matn qaytaradi. */
async function verifyTg(admin: Admin, token: string, phone: string, code: unknown, purpose: string, userId: string | null, consume: boolean): Promise<string | null> {
  const c = String(code || "").replace(/\D/g, "");
  if (!token || c.length !== 6) return "Telegram'dan kelgan 6 xonali kodni kiriting";
  const { data: row } = await admin.from("tg_verifications").select("*").eq("token", token).maybeSingle();
  if (!row || row.phone !== phone || row.purpose !== purpose || (purpose === "phone-change" && row.user_id !== userId)) {
    return "Telegram tasdiqlash so'rovi topilmadi. Qaytadan boshlang.";
  }
  const drop = () => admin.from("tg_verifications").delete().eq("token", token);
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await drop();
    return "Telegram kodining muddati tugagan. Qaytadan boshlang.";
  }
  if (row.status !== "code_sent" || !row.code_hash) {
    return "Avval Telegram botda raqamingizni tasdiqlang: havola orqali botni oching va «Raqamni ulashish» tugmasini bosing.";
  }
  if (((row.attempts as number) || 0) >= CODE_MAX_ATTEMPTS) {
    await drop();
    return "Juda ko'p noto'g'ri urinish. Qaytadan boshlang.";
  }
  if ((await hmacHex(`${token}|${phone}|${c}`)) !== row.code_hash) {
    const attempts = ((row.attempts as number) || 0) + 1;
    await admin.from("tg_verifications").update({ attempts }).eq("token", token);
    const left = CODE_MAX_ATTEMPTS - attempts;
    return left > 0 ? `Telegram kodi noto'g'ri (${left} ta urinish qoldi)` : "Juda ko'p noto'g'ri urinish. Qaytadan boshlang.";
  }
  if (consume) await drop();
  return null;
}

/** Ochiq sozlamalar (ro'yxatdan o'tish formasi shunga moslashadi). Maxfiy qiymatlar (token, secret) chiqmaydi. */
function publicSignup(c: SignupCfg, mailReady: boolean) {
  return {
    methods: { login: c.login, email: c.email, phone: c.phone, telegram: tgRegActive(c) },
    emailCode: c.emailCode,
    phoneTelegram: tgActive(c),
    tgBot: tgReady(c) ? c.tgBot : "",
    mailReady,
  };
}

function codeMail(code: string, purpose: string) {
  const what = purpose === "reset" ? "Parolni tiklash" : purpose === "change-email" ? "Emailni o'zgartirish" : "Ro'yxatdan o'tish";
  const subject = `${code} — Til sayohati tasdiqlash kodi`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#16201c">` +
    `<div style="font-size:20px;font-weight:700;color:#0f5f4d">🎫 Til sayohati</div>` +
    `<p style="font-size:15px;margin:18px 0 12px">${what} uchun tasdiqlash kodi:</p>` +
    `<div style="font-size:34px;font-weight:700;letter-spacing:8px;background:#e2f1eb;color:#0f5f4d;padding:16px 20px;border-radius:12px;text-align:center">${code}</div>` +
    `<p style="font-size:13px;color:#5d6a64;line-height:1.5;margin-top:16px">Kod 10 daqiqa amal qiladi. Uni hech kimga bermang. ` +
    `Agar bu so'rovni siz yubormagan bo'lsangiz, xatni e'tiborsiz qoldiring.</p></div>`;
  const text = `Til sayohati — ${what}\n\nTasdiqlash kodi: ${code}\n\nKod 10 daqiqa amal qiladi. Uni hech kimga bermang.`;
  return { subject, html, text };
}

/** Kodni tekshiradi; to'g'ri bo'lsa o'chiradi (bir martalik). Xato bo'lsa — matn qaytaradi. */
async function verifyCode(admin: Admin, email: string, purpose: string, code: unknown): Promise<string | null> {
  const c = String(code || "").replace(/\D/g, "");
  if (c.length !== 6) return "6 xonali kodni kiriting";
  const { data: row } = await admin.from("email_codes").select("*").eq("email", email).eq("purpose", purpose).maybeSingle();
  if (!row) return "Kod topilmadi. Yangi kod so'rang.";
  const drop = () => admin.from("email_codes").delete().eq("email", email).eq("purpose", purpose);
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await drop();
    return "Kod muddati tugagan. Yangi kod so'rang.";
  }
  if (((row.attempts as number) || 0) >= CODE_MAX_ATTEMPTS) {
    await drop();
    return "Juda ko'p noto'g'ri urinish. Yangi kod so'rang.";
  }
  if ((await hmacHex(`${email}|${purpose}|${c}`)) !== row.code_hash) {
    const attempts = ((row.attempts as number) || 0) + 1;
    await admin.from("email_codes").update({ attempts }).eq("email", email).eq("purpose", purpose);
    const left = CODE_MAX_ATTEMPTS - attempts;
    return left > 0 ? `Kod noto'g'ri (${left} ta urinish qoldi)` : "Juda ko'p noto'g'ri urinish. Yangi kod so'rang.";
  }
  await drop();
  return null;
}

async function emailTaken(admin: Admin, email: string, exceptId?: string): Promise<boolean> {
  let q = admin.from("profiles").select("id").ilike("email", email.replace(/[\\%_]/g, (ch) => "\\" + ch)).limit(1);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q;
  return !!data?.length;
}

const PUBLIC_ACTIONS = new Set(["login", "send-email-code", "register", "reset-with-code", "signup-config", "tg-start", "tg-status", "tg-reset-start"]);

/** Tokensiz (yoki o'z tokeni bilan) ishlaydigan ochiq amallar: kirish, kod yuborish, ro'yxatdan o'tish, parolni tiklash. */
async function handlePublic(action: string, body: Record<string, unknown>, req: Request): Promise<Response> {
  if (action === "login") return await handleLogin(body);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ip = clientIp(req);

  // ---------- Ro'yxatdan o'tish rejimi (forma qaysi qadamlarni ko'rsatishi uchun) ----------
  if (action === "signup-config") {
    const mail = await getMailConfig(admin);
    return json(publicSignup(await getSignupCfg(admin), !!(mail.apiKey && mail.from)));
  }

  // ---------- Telegram bot orqali ro'yxatdan o'tishni boshlash: raqam yozilmaydi — botda kontakt ulashiladi ----------
  if (action === "tg-start" && body.purpose === "register-tg") {
    const cfg = await getSignupCfg(admin);
    if (!tgRegActive(cfg)) return json({ error: "Telegram orqali ro'yxatdan o'tish yoqilmagan" }, 403);
    if (!(await allow(admin, `tgreg:${ip}`, 20, 3_600_000))) return json({ error: "Juda ko'p so'rov. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    const token = randomToken(18);
    await admin.from("tg_verifications").delete().lt("expires_at", new Date().toISOString());
    const { error } = await admin.from("tg_verifications").insert({
      token,
      phone: null,
      purpose: "register-tg",
      user_id: null,
      status: "pending",
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, token, bot: cfg.tgBot, link: `https://t.me/${cfg.tgBot}?start=${token}` });
  }

  // Sayt so'rovi holatini so'rab turadi (bot kontakt olganda 'verified' bo'ladi). Token — 144 bitli maxfiy, taxmin qilib bo'lmaydi.
  if (action === "tg-status") {
    const token = String(body.token || "");
    if (token.length < 10 || token.length > 64) return json({ status: "expired" });
    const { data: row } = await admin.from("tg_verifications").select("status, phone, purpose, expires_at").eq("token", token).maybeSingle();
    if (!row || row.purpose !== "register-tg" || new Date(row.expires_at as string).getTime() < Date.now()) return json({ status: "expired" });
    return json({ status: row.status, phone: row.status === "verified" && row.phone ? maskPhone(String(row.phone)) : "" });
  }

  // ---------- Parolni Telegram orqali tiklash: kod raqam bog'langan Telegram chatiga yuboriladi ----------
  if (action === "tg-reset-start") {
    const cfg = await getSignupCfg(admin);
    const unavailable = json({ error: "Bu raqam uchun Telegram orqali tiklash mavjud emas. Email orqali tiklang yoki administratorga murojaat qiling." }, 400);
    if (!tgReady(cfg)) return unavailable;
    const d = normalizePhone(String(body.phone || ""));
    if (!d) return json({ error: "Telefon raqamini to'g'ri kiriting (masalan: +998 90 123 45 67)" }, 400);
    if (!(await allow(admin, `tgrip:${ip}`, 15, 3_600_000))) return json({ error: "Juda ko'p so'rov. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    if (!(await allow(admin, `tgrph:${d}`, 5, 3_600_000))) return json({ error: "Bu raqam uchun juda ko'p so'rov yuborildi. 1 soatdan keyin qayta urinib ko'ring." }, 429);
    const { data: prof } = await admin.from("profiles").select("id").eq("phone", "+" + d).maybeSingle();
    if (!prof) return unavailable;
    const token = await sendCodeToLinked(admin, cfg, d, "reset", prof.id as string);
    if (!token) return unavailable;
    return json({ ok: true, token });
  }

  // ---------- Telegram orqali telefon tasdiqlashni boshlash: kod bog'langan chatga darhol yuboriladi yoki bot havolasi qaytariladi ----------
  if (action === "tg-start") {
    const cfg = await getSignupCfg(admin);
    if (!tgActive(cfg)) return json({ error: "Telegram orqali tasdiqlash yoqilmagan" }, 400);
    const purpose = body.purpose === "phone-change" ? "phone-change" : "register";
    let userId: string | null = null;
    if (purpose === "phone-change") {
      const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data: { user } } = await caller.auth.getUser();
      if (!user) return json({ error: "Kirish talab qilinadi" }, 401);
      userId = user.id;
    } else if (!cfg.phone) {
      return json({ error: "Telefon raqami orqali ro'yxatdan o'tish o'chirilgan" }, 403);
    }
    const d = normalizePhone(String(body.phone || ""));
    if (!d) return json({ error: "Telefon raqamini to'g'ri kiriting (masalan: +998 90 123 45 67)" }, 400);
    const { data: taken } = await admin.from("profiles").select("id").eq("phone", "+" + d).maybeSingle();
    if (taken && taken.id !== userId) {
      return json({ error: purpose === "register" ? "Bu telefon raqami allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning." : "Bu telefon raqami boshqa hisobga biriktirilgan" }, 400);
    }
    if (!(await allow(admin, `tgip:${ip}`, 15, 3_600_000))) return json({ error: "Juda ko'p so'rov. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    if (!(await allow(admin, `tgph:${d}`, 6, 3_600_000))) return json({ error: "Bu raqam uchun juda ko'p so'rov yuborildi. 1 soatdan keyin qayta urinib ko'ring." }, 429);

    // Raqam avval bot orqali tasdiqlangan bo'lsa — kod darhol Telegramga ketadi (botni qayta ochish shart emas)
    const direct = await sendCodeToLinked(admin, cfg, d, purpose, userId);
    if (direct) return json({ ok: true, direct: true, token: direct, bot: cfg.tgBot, link: `https://t.me/${cfg.tgBot}` });

    const token = randomToken(18);
    await admin.from("tg_verifications").delete().lt("expires_at", new Date().toISOString());
    await admin.from("tg_verifications").delete().eq("phone", d).eq("purpose", purpose);
    const { error } = await admin.from("tg_verifications").insert({
      token,
      phone: d,
      purpose,
      user_id: userId,
      status: "pending",
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, token, bot: cfg.tgBot, link: `https://t.me/${cfg.tgBot}?start=${token}` });
  }

  // ---------- Emailga kod yuborish ----------
  if (action === "send-email-code") {
    const email = normEmail(body.email);
    const purpose = String(body.purpose || "");
    if (!CODE_PURPOSES.includes(purpose)) return json({ error: "Noto'g'ri so'rov" }, 400);
    if (!EMAIL_RE.test(email) || email.endsWith("@" + SYNTH_DOMAIN)) return json({ error: "Email manzili noto'g'ri" }, 400);

    let userId: string | undefined;
    if (purpose === "change-email") {
      const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data: { user } } = await caller.auth.getUser();
      if (!user) return json({ error: "Kirish talab qilinadi" }, 401);
      userId = user.id;
    }

    if (!(await allow(admin, `codeip:${ip}`, 15, 3_600_000))) return json({ error: "Juda ko'p so'rov. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    if (!(await allow(admin, `codeem:${email}`, 5, 3_600_000))) return json({ error: "Bu emailga juda ko'p kod yuborildi. 1 soatdan keyin qayta urinib ko'ring." }, 429);

    if (purpose === "register" && (await emailTaken(admin, email))) {
      return json({ error: "Bu email allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning." }, 400);
    }
    if (purpose === "change-email" && (await emailTaken(admin, email, userId))) {
      return json({ error: "Bu email boshqa hisobga biriktirilgan" }, 400);
    }
    if (purpose === "reset" && !(await emailTaken(admin, email))) {
      // Email mavjudligini oshkor qilmaymiz — har doim "yuborildi" deymiz
      return json({ ok: true, cooldown: CODE_COOLDOWN_MS / 1000 });
    }

    const { data: prev } = await admin.from("email_codes").select("created_at").eq("email", email).eq("purpose", purpose).maybeSingle();
    if (prev && Date.now() - new Date(prev.created_at as string).getTime() < CODE_COOLDOWN_MS) {
      return json({ error: "Kodni qayta yuborish uchun 1 daqiqa kuting" }, 429);
    }

    const cfg = await getMailConfig(admin);
    if (!cfg.apiKey || !cfg.from) {
      return json({ error: "Email xizmati hali sozlanmagan. Administratorga murojaat qiling yoki telefon raqami bilan ro'yxatdan o'ting." }, 503);
    }

    const code = randomCode();
    await admin.from("email_codes").delete().lt("expires_at", new Date().toISOString());
    await admin.from("email_codes").upsert({
      email,
      purpose,
      code_hash: await hmacHex(`${email}|${purpose}|${code}`),
      attempts: 0,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      created_at: new Date().toISOString(),
    });
    try {
      const m = codeMail(code, purpose);
      await sendMail(cfg, email, m.subject, m.html, m.text);
    } catch (e) {
      console.error("Email yuborilmadi:", (e as Error).message);
      await admin.from("email_codes").delete().eq("email", email).eq("purpose", purpose);
      return json({ error: "Xatni yuborib bo'lmadi. Email manzilini tekshiring yoki birozdan keyin qayta urinib ko'ring." }, 502);
    }
    return json({ ok: true, cooldown: CODE_COOLDOWN_MS / 1000 });
  }

  // ---------- Ro'yxatdan o'tish ----------
  // Usullarni super admin yoqadi/o'chiradi: oddiy (login + parol), email (kod bilan yoki kodsiz), telefon (Telegram kodi bilan yoki kodsiz).
  if (action === "register") {
    if (!(await allow(admin, `reg:${ip}`, 20, 3_600_000))) return json({ error: "Juda ko'p urinish. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    const cfg = await getSignupCfg(admin);
    const email = normEmail(body.email);
    const phoneRaw = String(body.phone || "").trim();
    const hasPhone = phoneRaw.replace(/\D/g, "").length > 3;
    const loginName = String(body.username || "").trim();
    const password = String(body.password || "");
    if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, 400);

    // Telegram bot orqali: email/telefon/login yo'q, faqat botda tasdiqlangan so'rov tokeni (raqam kontaktdan olingan)
    const regTgToken = String(body.tgToken || "");
    const tgReg = !email && !hasPhone && !loginName && !!regTgToken;
    const simple = !email && !hasPhone && !tgReg;
    if (tgReg) {
      if (!tgRegActive(cfg)) return json({ error: "Telegram orqali ro'yxatdan o'tish yoqilmagan" }, 403);
    } else if (simple) {
      if (!cfg.login) return json({ error: "Email yoki telefon raqamidan kamida bittasini kiriting" }, 400);
    } else {
      if (email && !cfg.email) return json({ error: "Email orqali ro'yxatdan o'tish o'chirilgan" }, 403);
      if (hasPhone && !cfg.phone) return json({ error: "Telefon raqami orqali ro'yxatdan o'tish o'chirilgan" }, 403);
    }

    let phone: string | null = null;
    let phoneDigits = "";
    if (tgReg) {
      const { data: row } = await admin.from("tg_verifications").select("*").eq("token", regTgToken).maybeSingle();
      if (!row || row.purpose !== "register-tg" || new Date(row.expires_at as string).getTime() < Date.now()) {
        return json({ error: "Telegram tasdiqlash so'rovi topilmadi. Qaytadan boshlang.", tgError: true }, 400);
      }
      if (row.status !== "verified" || !row.phone) {
        return json({ error: "Avval Telegram botda raqamingizni tasdiqlang: botni oching va «Raqamni ulashish» tugmasini bosing.", tgError: true }, 400);
      }
      phoneDigits = String(row.phone);
      phone = "+" + phoneDigits;
      const { data: taken } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
      if (taken) return json({ error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning." }, 400);
    } else if (hasPhone) {
      const d = normalizePhone(phoneRaw);
      if (!d) return json({ error: "Telefon raqamini to'g'ri kiriting (masalan: +998 90 123 45 67)" }, 400);
      phoneDigits = d;
      phone = "+" + d;
      const { data: taken } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
      if (taken) return json({ error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning." }, 400);
    }

    let authEmail: string;
    let username: string;
    if (email) {
      if (!EMAIL_RE.test(email) || email.endsWith("@" + SYNTH_DOMAIN)) return json({ error: "Email manzili noto'g'ri" }, 400);
      if (await emailTaken(admin, email)) return json({ error: "Bu email allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning." }, 400);
      authEmail = email;
      username = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 30) || "user";
    } else if (phone) {
      authEmail = `tel${phoneDigits}@${SYNTH_DOMAIN}`;
      username = phoneDigits;
    } else {
      // Oddiy usul: ism + login + parol (tasdiqlashsiz)
      if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(loginName)) {
        return json({ error: "Login 3–40 belgidan iborat bo'lsin: lotin harflari, raqamlar, _ . - belgilari" }, 400);
      }
      const { data: used } = await admin.from("profiles").select("id").ilike("username", loginName.replace(/[\\%_]/g, (ch) => "\\" + ch)).limit(1);
      if (used?.length) return json({ error: "Bu login band. Boshqa login tanlang." }, 400);
      authEmail = `${loginName.toLowerCase()}@${SYNTH_DOMAIN}`;
      username = loginName;
    }

    // Tasdiqlash kodlari (qaysi biri talab qilinsa). Telegram kodi avval tekshiriladi (sarflanmaydi), email kodi sarflanadi,
    // oxirida Telegram so'rovi o'chiriladi — shunda biri xato bo'lsa, ikkinchisini qayta so'rash shart emas.
    const needTg = !!phone && !tgReg && tgActive(cfg);
    const needEmailCode = !!email && cfg.emailCode;
    const tgToken = String(body.tgToken || "");
    if (needTg) {
      const bad = await verifyTg(admin, tgToken, phoneDigits, body.tgCode, "register", null, false);
      if (bad) return json({ error: bad, tgError: true }, 400);
    }
    if (needEmailCode) {
      const bad = await verifyCode(admin, email, "register", body.code);
      if (bad) return json({ error: bad, codeError: true }, 400);
    }

    const displayName = String(body.displayName || "").trim().slice(0, 60) || username;
    const { error } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName, phone: phone || undefined },
    });
    if (error) {
      const msg = /already|registered|exists/i.test(error.message) ? "Bu email, telefon yoki login allaqachon ro'yxatdan o'tgan" : error.message;
      return json({ error: msg }, 400);
    }
    if (needTg || tgReg) await admin.from("tg_verifications").delete().eq("token", tgToken);
    return json({ ok: true, email: authEmail });
  }

  // ---------- Parolni kod bilan tiklash ----------
  if (action === "reset-with-code") {
    if (!(await allow(admin, `rst:${ip}`, 20, 3_600_000))) return json({ error: "Juda ko'p urinish. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    const email = normEmail(body.email);
    const password = String(body.password || "");

    // Telegram orqali: raqam + botdan kelgan kod
    if (!email && body.tgToken) {
      const d = normalizePhone(String(body.phone || ""));
      if (!d) return json({ error: "Telefon raqamini to'g'ri kiriting (masalan: +998 90 123 45 67)" }, 400);
      if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, 400);
      const bad = await verifyTg(admin, String(body.tgToken), d, body.code, "reset", null, true);
      if (bad) return json({ error: bad, tgError: true }, 400);
      const { data: prof } = await admin.from("profiles").select("id").eq("phone", "+" + d).maybeSingle();
      if (!prof) return json({ error: "Hisob topilmadi" }, 404);
      const { error } = await admin.auth.admin.updateUserById(prof.id as string, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (!EMAIL_RE.test(email)) return json({ error: "Email manzili noto'g'ri" }, 400);
    if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, 400);
    const bad = await verifyCode(admin, email, "reset", body.code);
    if (bad) return json({ error: bad, codeError: true }, 400);
    const { data: prof } = await admin.from("profiles").select("id").ilike("email", email.replace(/[\\%_]/g, (ch) => "\\" + ch)).limit(1);
    const id = prof?.[0]?.id as string | undefined;
    if (!id) return json({ error: "Hisob topilmadi" }, 404);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return json({ error: error.message }, 400);
    await admin.from("login_attempts").delete().eq("key", email);
    return json({ ok: true });
  }

  return json({ error: "Noma'lum amal" }, 400);
}

const LOGIN_FAIL = "Login (email/telefon) yoki parol noto'g'ri";
const MAX_FAILS = 10; // 15 daqiqa ichida shuncha noto'g'ri urinishdan keyin hisob vaqtincha qulflanadi
const LOCK_MINUTES = 15;

/** Ochiq (tokensiz) kirish: telefon yoki login bo'yicha foydalanuvchining email'ini topib,
 *  server tomonda parol bilan kiradi va sessiyani qaytaradi. Email'lar klientga oshkor bo'lmaydi. */
async function handleLogin(body: Record<string, unknown>): Promise<Response> {
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "");
  if (!identifier || !password) return json({ error: "Login va parolni kiriting" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const key = identifier.toLowerCase().slice(0, 120);

  const { data: att } = await admin.from("login_attempts").select("*").eq("key", key).maybeSingle();
  if (att?.locked_until && new Date(att.locked_until as string).getTime() > Date.now()) {
    return json({ error: `Juda ko'p noto'g'ri urinish. ${LOCK_MINUTES} daqiqadan keyin qayta urinib ko'ring.` }, 429);
  }

  async function registerFail() {
    const now = Date.now();
    const fresh = !att || now - new Date(att.window_start as string).getTime() > LOCK_MINUTES * 60_000;
    const fails = fresh ? 1 : ((att!.fails as number) || 0) + 1;
    await admin.from("login_attempts").upsert({
      key,
      fails,
      window_start: fresh ? new Date(now).toISOString() : att!.window_start,
      locked_until: fails >= MAX_FAILS ? new Date(now + LOCK_MINUTES * 60_000).toISOString() : null,
    });
  }

  // Identifikatorni Auth email'iga aylantiramiz
  let email: string | null = null;
  const ident = resolveIdentifier(identifier);
  if (ident?.kind === "email") {
    email = ident.email;
  } else if (ident) {
    let profileId: string | null = null;
    if (ident.kind === "phone") {
      const { data } = await admin.from("profiles").select("id").eq("phone", ident.phone).maybeSingle();
      profileId = (data?.id as string) || null;
    } else {
      const pattern = ident.username.replace(/[\\%_]/g, (c) => "\\" + c);
      const { data } = await admin.from("profiles").select("id").ilike("username", pattern).limit(1);
      profileId = (data?.[0]?.id as string) || null;
    }
    if (profileId) {
      const { data: u } = await admin.auth.admin.getUserById(profileId);
      email = u?.user?.email || null;
    } else {
      email = ident.email; // eski hisoblar: sun'iy email bilan to'g'ridan-to'g'ri sinab ko'ramiz
    }
  }
  if (!email) {
    await registerFail();
    return json({ error: LOGIN_FAIL }, 400);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    await registerFail();
    if (error && /banned/i.test(error.message)) return json({ error: "Hisobingiz bloklangan. Administrator bilan bog'laning." }, 403);
    return json({ error: LOGIN_FAIL }, 400);
  }
  await admin.from("login_attempts").delete().eq("key", key);
  return json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Faqat POST so'rovlar qabul qilinadi" }, 405);

  try {
    // Telegram bot webhook'i: sarlavhadagi maxfiy token bilan tasdiqlanadi (Telegram har so'rovga qo'shadi)
    if (req.headers.get("x-telegram-bot-api-secret-token") !== null) {
      const tgAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      const tgCfg = await getSignupCfg(tgAdmin);
      const given = req.headers.get("x-telegram-bot-api-secret-token") || "";
      if (!tgCfg.tgSecret || !safeEqual(given, tgCfg.tgSecret)) return new Response("forbidden", { status: 403 });
      try {
        await processTgUpdate(tgAdmin, tgCfg, await req.json().catch(() => ({})));
      } catch (e) {
        console.error("Telegram yangilanishida xato:", (e as Error).message);
      }
      return new Response("ok", { status: 200 }); // Telegram qayta yubormasligi uchun doim 200
    }

    // Ochiq amallar (tokensiz): kirish, kod yuborish, ro'yxatdan o'tish, parolni tiklash
    const peek = await req.clone().json().catch(() => ({}));
    if (PUBLIC_ACTIONS.has(String(peek?.action))) return await handlePublic(String(peek.action), peek, req);

    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Kirish talab qilinadi" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: callerProfile } = await admin.from("profiles").select("role, is_blocked, permissions").eq("id", user.id).single();
    const callerRole = (callerProfile?.role as string) || "user";
    if (callerProfile?.is_blocked) return json({ error: "Hisobingiz bloklangan" }, 403);
    const isStaff = callerRole === "admin" || callerRole === "superadmin";
    const isSuper = callerRole === "superadmin";
    const callerPerms = (callerProfile?.permissions as string[] | null | undefined) || [];
    /** Funksiya ruxsati: super adminda doim bor; adminda — faqat super admin bergan bo'lsa; o'quvchida hech qachon. */
    const can = (perm: string) => isSuper || (callerRole === "admin" && callerPerms.includes(perm));

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const forbid = () => json({ error: "Bu amal uchun ruxsatingiz yo'q" }, 403);

    async function getTarget(id: string) {
      const { data } = await admin.from("profiles").select("*").eq("id", id).single();
      return data as Profile | null;
    }

    // Foydalanuvchilar ro'yxati va ularni boshqarish: super admin — hammani; oddiy admin — faqat unga berilgan ruxsatlar doirasida
    // va FAQAT o'quvchilarni (adminlar va super admin ma'lumotlari hech kimga ko'rinmaydi).
    const superOnly = () => json({ error: "Bu amal faqat super admin uchun" }, 403);

    /** Super admin o'zidan boshqa hammani boshqara oladi; super adminning o'zini — hech kim. Oddiy admin — faqat o'quvchilarni. */
    function canManage(target: Profile) {
      return isSuper ? target.role !== "superadmin" : callerRole === "admin" && target.role === "user";
    }

    // =====================================================================
    // O'Z KIRISH MA'LUMOTLARINI O'ZGARTIRISH (har qanday foydalanuvchi):
    // email qo'shish/almashtirish va telefon qo'shish/almashtirish/olib tashlash
    // =====================================================================
    if (action === "update-my-contact") {
      const { data: me } = await admin.from("profiles").select("*").eq("id", user.id).single();
      if (!me) return json({ error: "Profil topilmadi" }, 404);
      const authEmail = String(user.email || "").toLowerCase();
      const hasRealEmail = !!authEmail && !authEmail.endsWith("@" + SYNTH_DOMAIN);
      const profilePatch: Record<string, unknown> = {};

      if (body.email !== undefined) {
        const e = String(body.email || "").trim().toLowerCase();
        if (!e) {
          if (hasRealEmail) return json({ error: "Emailni o'chirib bo'lmaydi — faqat boshqasiga almashtirish mumkin" }, 400);
        } else {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.endsWith("@" + SYNTH_DOMAIN)) {
            return json({ error: "Email manzili noto'g'ri" }, 400);
          }
          if (e !== authEmail) {
            // Yangi emailni (kod talabi yoqilgan bo'lsa) faqat emailga yuborilgan kod orqali tasdiqlagan foydalanuvchi o'rnata oladi
            if (await getSignupEmailCode(admin)) {
              const bad = await verifyCode(admin, e, "change-email", body.emailCode);
              if (bad) return json({ error: bad, codeError: true }, 400);
            } else if (await emailTaken(admin, e, user.id)) {
              return json({ error: "Bu email boshqa hisobga biriktirilgan" }, 400);
            }
            const { error } = await admin.auth.admin.updateUserById(user.id, { email: e, email_confirm: true });
            if (error) {
              const msg = /already|registered|exists|unique/i.test(error.message) ? "Bu email boshqa hisobga biriktirilgan" : error.message;
              return json({ error: msg }, 400);
            }
          }
          profilePatch.email = e;
        }
      }

      if (body.phone !== undefined) {
        const raw = String(body.phone || "").trim();
        if (!raw || raw.replace(/\D/g, "") === "998") {
          const nowHasEmail = hasRealEmail || !!profilePatch.email;
          if (!nowHasEmail) return json({ error: "Telefonni olib tashlash uchun avval email qo'shing (kirish usuli qolishi kerak)" }, 400);
          profilePatch.phone = null;
        } else {
          const d = normalizePhone(raw);
          if (!d) return json({ error: "Telefon raqamini to'g'ri kiriting (masalan: +998 90 123 45 67)" }, 400);
          const phone = "+" + d;
          const { data: other } = await admin.from("profiles").select("id").eq("phone", phone).neq("id", user.id).maybeSingle();
          if (other) return json({ error: "Bu telefon raqami boshqa hisobga biriktirilgan" }, 400);
          // Telegram tasdiqlash yoqilgan bo'lsa, yangi raqamni Telegram kodi bilan tasdiqlash shart
          if (phone !== me.phone && tgActive(await getSignupCfg(admin))) {
            const bad = await verifyTg(admin, String(body.tgToken || ""), d, body.tgCode, "phone-change", user.id, true);
            if (bad) return json({ error: bad, tgError: true }, 400);
          }
          profilePatch.phone = phone;
        }
      }

      if (Object.keys(profilePatch).length) {
        const { error } = await admin.from("profiles").update(profilePatch).eq("id", user.id);
        if (error) {
          const msg = /duplicate|unique/i.test(error.message) ? "Bu telefon raqami boshqa hisobga biriktirilgan" : error.message;
          return json({ error: msg }, 400);
        }
      }
      const updated = await getTarget(user.id);
      return json({ user: publicUser(updated || me) });
    }

    // =====================================================================
    // FOYDALANUVCHILAR
    // =====================================================================
    if (action === "list-users") {
      if (!can("users_view")) return forbid();
      let pq = admin.from("profiles").select("*").order("created_at", { ascending: true });
      if (!isSuper) pq = pq.eq("role", "user"); // adminga faqat o'quvchilar ko'rinadi
      const { data: profiles, error } = await pq;
      if (error) return json({ error: error.message }, 400);
      // Auth ma'lumotlari (oxirgi kirish vaqti) — bir necha sahifa bo'lishi mumkin
      const lastSignIn: Record<string, string | null> = {};
      for (let page = 1; page <= 10; page++) {
        const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listErr || !data?.users?.length) break;
        data.users.forEach((u) => (lastSignIn[u.id] = u.last_sign_in_at || null));
        if (data.users.length < 1000) break;
      }
      return json({ users: (profiles || []).map((p) => publicUser(p, { lastSignInAt: lastSignIn[p.id as string] || null })) });
    }

    if (action === "user-detail") {
      if (!can("users_view")) return forbid();
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (!isSuper && target.role !== "user") return json({ error: "Foydalanuvchi topilmadi" }, 404);
      const { data: prog } = await admin
        .from("progress")
        .select("state, updated_at")
        .eq("user_id", target.id as string)
        .maybeSingle();
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await admin.from("ai_usage").select("count").eq("user_id", target.id as string).eq("day", today).maybeSingle();
      return json({ user: publicUser(target), progress: prog?.state || {}, progressUpdatedAt: prog?.updated_at || null, aiUsedToday: usage?.count || 0 });
    }

    // Super admin: 'user' yoki 'admin' yaratadi. Oddiy admin ("Foydalanuvchi qo'shish" ruxsati bilan) — faqat o'quvchi.
    if (action === "create-user" || action === "create-admin") {
      if (!can("users_add")) return forbid();
      const wantsAdmin = action === "create-admin" || body.role === "admin";
      if (wantsAdmin && !isSuper) return json({ error: "Admin qo'shishni faqat super admin bajaradi" }, 403);
      const role = wantsAdmin ? "admin" : "user";
      const ident = resolveIdentifier(String(body.identifier || body.username || ""));
      if (!ident) {
        return json({ error: "Login (kamida 3 belgi: harf, raqam, _ . -), email yoki telefon raqamini to'g'ri kiriting" }, 400);
      }
      const password = String(body.password || "");
      if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, 400);
      const displayName = String(body.displayName || "").trim() || ident.username;

      // Qo'shimcha telefon (ixtiyoriy): login yoki email bilan birga telefon ham biriktiriladi
      let phone = ident.phone;
      const extraPhone = String(body.phone || "").trim();
      if (!phone && extraPhone && extraPhone.replace(/\D/g, "") !== "998") {
        const d = normalizePhone(extraPhone);
        if (!d) return json({ error: "Telefon raqami noto'g'ri" }, 400);
        phone = "+" + d;
      }
      if (phone) {
        const { data: taken } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
        if (taken) return json({ error: "Bu telefon raqami boshqa hisobga biriktirilgan" }, 400);
      }

      const { data: created, error } = await admin.auth.admin.createUser({
        email: ident.email,
        password,
        email_confirm: true,
        user_metadata: { username: ident.username, display_name: displayName, phone: phone || undefined },
      });
      if (error) {
        const msg = /already|registered|exists/i.test(error.message) ? "Bu login / email / telefon allaqachon ro'yxatdan o'tgan" : error.message;
        return json({ error: msg }, 400);
      }
      const uid = created.user!.id;
      // Yangi adminga (agar belgilanmagan bo'lsa) hamma tur ruxsat etiladi — super admin keyin "Ruxsatlar" bo'limida o'zgartiradi
      // Funksiya ruxsatlari: standart — faqat ko'rish (AI, email, statistika); foydalanuvchilar bilan ishlash ruxsatini super admin alohida beradi
      if (role !== "user") {
        await admin.from("profiles").update({
          role,
          upload_kinds: sanitizeKinds(body.uploadKinds) ?? MEDIA_KINDS,
          permissions: sanitizePerms(body.permissions) ?? DEFAULT_ADMIN_PERMS,
        }).eq("id", uid);
      }
      const prof = await getTarget(uid);
      return json({ user: publicUser(prof || { id: uid, username: ident.username, display_name: displayName, role }) });
    }

    if (action === "delete-user" || action === "delete-admin") {
      if (!can("users_delete")) return forbid();
      const targetId = String(body.id || "");
      if (targetId === user.id) return json({ error: "O'zingizni o'chira olmaysiz" }, 400);
      const target = await getTarget(targetId);
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (!isSuper && target.role !== "user") return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (target.role === "superadmin") return json({ error: "Super adminni o'chirib bo'lmaydi" }, 400);
      if (!canManage(target)) return json({ error: "Adminni faqat super admin o'chira oladi" }, 403);
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "set-role") {
      if (!isSuper) return json({ error: "Rolni faqat super admin o'zgartira oladi" }, 403);
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (target.id === user.id) return json({ error: "O'z rolingizni o'zgartira olmaysiz" }, 400);
      if (target.role === "superadmin") return json({ error: "Super admin rolini o'zgartirib bo'lmaydi" }, 400);
      const role = body.role === "admin" ? "admin" : "user";
      // Admin bo'lganda: ruxsatlar berilgan bo'lsa — shular, aks holda avvalgilari, ular ham bo'sh bo'lsa — hamma tur.
      // O'quvchiga qaytarilganda ruxsatlar tozalanadi (keyin qayta admin qilinsa, yangidan beriladi).
      const current = (target.upload_kinds as string[] | null) || [];
      const upload_kinds = role === "admin" ? sanitizeKinds(body.uploadKinds) ?? (current.length ? current : MEDIA_KINDS) : [];
      const currentPerms = (target.permissions as string[] | null) || [];
      const permissions = role === "admin" ? sanitizePerms(body.permissions) ?? (target.role === "admin" ? currentPerms : DEFAULT_ADMIN_PERMS) : [];
      const { error } = await admin.from("profiles").update({ role, upload_kinds, permissions }).eq("id", target.id as string);
      if (error) return json({ error: error.message }, 400);
      return json({ user: publicUser({ ...target, role, upload_kinds, permissions }) });
    }

    // Adminlarning ruxsatlari — faqat super admin: yuklash (qaysi turdagi materialni qo'sha/tahrirlay/o'chira olishi)
    // va funksiyalar (foydalanuvchilarni ko'rish/qo'shish/bloklash…, AI, email, statistika). Ikkalasidan kamida bittasi yuboriladi.
    if (action === "set-permissions") {
      if (!isSuper) return json({ error: "Ruxsatlarni faqat super admin belgilaydi" }, 403);
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (target.role !== "admin") return json({ error: "Ruxsatlar faqat adminlar uchun belgilanadi (super adminda hamma ruxsat bor)" }, 400);
      const patch: Record<string, unknown> = {};
      if (body.uploadKinds !== undefined) {
        const kinds = sanitizeKinds(body.uploadKinds);
        if (!kinds) return json({ error: "Ruxsatlar ro'yxati noto'g'ri" }, 400);
        patch.upload_kinds = kinds;
      }
      if (body.permissions !== undefined) {
        const perms = sanitizePerms(body.permissions);
        if (!perms) return json({ error: "Ruxsatlar ro'yxati noto'g'ri" }, 400);
        patch.permissions = perms;
      }
      if (!Object.keys(patch).length) return json({ error: "Ruxsatlar ro'yxati noto'g'ri" }, 400);
      const { error } = await admin.from("profiles").update(patch).eq("id", target.id as string);
      if (error) return json({ error: error.message }, 400);
      return json({ user: publicUser({ ...target, ...patch }) });
    }

    if (action === "reset-password") {
      if (!can("users_reset")) return forbid();
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (!isSuper && target.role !== "user") return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (target.id !== user.id && !canManage(target)) return forbid();
      const password = String(body.password || "");
      if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.id as string, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "block-user") {
      if (!can("users_block")) return forbid();
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (!isSuper && target.role !== "user") return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (target.id === user.id) return json({ error: "O'zingizni bloklay olmaysiz" }, 400);
      if (!canManage(target)) return forbid();
      const blocked = Boolean(body.blocked);
      const { error } = await admin.auth.admin.updateUserById(target.id as string, {
        ban_duration: blocked ? "876000h" : "none",
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ is_blocked: blocked }).eq("id", target.id as string);
      return json({ user: publicUser({ ...target, is_blocked: blocked }) });
    }

    if (action === "stats") {
      if (!can("stats_view")) return forbid();
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: roles }, { data: media }, { data: usage }, { count: keyCount }] = await Promise.all([
        admin.from("profiles").select("role, created_at, last_seen_at"),
        admin.from("media_items").select("kind"),
        admin.from("ai_usage").select("count").eq("day", today),
        admin.from("api_keys").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);
      const byRole: Record<string, number> = { user: 0, admin: 0, superadmin: 0 };
      let newThisWeek = 0;
      let activeToday = 0;
      const weekAgo = Date.now() - 7 * 864e5;
      (roles || []).forEach((r) => {
        byRole[r.role as string] = (byRole[r.role as string] || 0) + 1;
        if (new Date(r.created_at as string).getTime() > weekAgo) newThisWeek += 1;
        if (r.last_seen_at && String(r.last_seen_at).slice(0, 10) === today) activeToday += 1;
      });
      const mediaByKind: Record<string, number> = {};
      (media || []).forEach((m) => (mediaByKind[m.kind as string] = (mediaByKind[m.kind as string] || 0) + 1));
      const aiToday = (usage || []).reduce((s, u) => s + ((u.count as number) || 0), 0);
      // Foydalanuvchilar soni va tarkibi — faqat super adminga; oddiy admin faqat kontent/AI statistikasini oladi
      return json({
        users: isSuper ? (roles || []).length : null,
        byRole: isSuper ? byRole : null,
        newThisWeek: isSuper ? newThisWeek : null,
        activeToday: isSuper ? activeToday : null,
        mediaByKind,
        aiToday,
        activeKeys: keyCount || 0,
      });
    }

    // =====================================================================
    // AI SOZLAMALARI
    // =====================================================================
    async function aiSettingsSnapshot() {
      const { data: rows } = await admin.from("settings").select("key, value").like("key", "ai_%");
      const s: Record<string, string> = {};
      (rows || []).forEach((r) => (s[r.key as string] = r.value as string));
      const { data: keys } = await admin.from("api_keys").select("provider, is_active");
      const activeByProvider: Record<string, number> = {};
      (keys || []).forEach((k) => {
        if (k.is_active) activeByProvider[k.provider as string] = (activeByProvider[k.provider as string] || 0) + 1;
      });
      const configured = (s.ai_provider || "auto").toLowerCase();
      const activeKeyCount = configured === "auto"
        ? Object.values(activeByProvider).reduce((a, b) => a + b, 0)
        : activeByProvider[configured] || 0;
      const provider = configured === "mock" || activeKeyCount === 0 ? "mock" : configured;
      return {
        provider,
        configuredProvider: configured,
        hasKey: activeKeyCount > 0,
        activeKeyCount,
        activeByProvider,
        models: { gemini: s.ai_model_gemini || "gemini-flash-latest" },
        dailyLimit: Number(s.ai_daily_limit || 150),
        tutorStyle: s.ai_tutor_style || "",
      };
    }

    if (action === "get-ai-settings") {
      if (!can("ai_view")) return forbid();
      return json(await aiSettingsSnapshot());
    }

    if (action === "save-ai-settings") {
      if (!isSuper) return forbid();
      const upserts: { key: string; value: string }[] = [];
      if (body.provider !== undefined) {
        const p = String(body.provider).toLowerCase();
        if (!PROVIDER_MODES.includes(p)) return json({ error: "Noto'g'ri provayder qiymati" }, 400);
        upserts.push({ key: "ai_provider", value: p });
      }
      if (body.geminiModel !== undefined) {
        upserts.push({ key: "ai_model_gemini", value: String(body.geminiModel).trim() || "gemini-flash-latest" });
      }
      if (body.dailyLimit !== undefined) {
        const n = Math.max(0, Math.min(10000, parseInt(String(body.dailyLimit), 10) || 0));
        upserts.push({ key: "ai_daily_limit", value: String(n) });
      }
      if (body.tutorStyle !== undefined) {
        upserts.push({ key: "ai_tutor_style", value: String(body.tutorStyle).slice(0, 1000) });
      }
      if (upserts.length) {
        const { error } = await admin.from("settings").upsert(upserts, { onConflict: "key" });
        if (error) return json({ error: error.message }, 400);
      }
      return json(await aiSettingsSnapshot());
    }

    // =====================================================================
    // EMAIL XIZMATI (kod yuborish uchun): Brevo yoki Resend
    // =====================================================================
    if (action === "get-mail-settings") {
      if (!can("mail_view")) return forbid();
      const cfg = await getMailConfig(admin);
      return json({
        provider: cfg.provider,
        from: cfg.from,
        fromName: cfg.fromName,
        hasKey: !!cfg.apiKey,
        maskedKey: cfg.apiKey ? maskKey(cfg.apiKey) : "",
        configured: !!(cfg.apiKey && cfg.from),
        signupEmailCode: await getSignupEmailCode(admin),
        // Email xizmati ro'yxatdan o'tish uchun kerakmi (email usuli yoqilgan va kod talab qilinadi)
        signupNeedsMail: await getSignupCfg(admin).then((c) => c.email && c.emailCode),
      });
    }

    // =====================================================================
    // RO'YXATDAN O'TISH USULLARI va TELEGRAM BOT — faqat super admin
    // =====================================================================
    async function signupSnapshot() {
      const c = await getSignupCfg(admin);
      const mail = await getMailConfig(admin);
      return {
        login: c.login,
        email: c.email,
        phone: c.phone,
        emailCode: c.emailCode,
        phoneTelegram: c.phoneTelegram,
        telegram: c.telegram,
        mailReady: !!(mail.apiKey && mail.from),
        tg: { connected: tgReady(c), username: c.tgBot, maskedToken: c.tgToken ? maskKey(c.tgToken) : "" },
      };
    }

    if (action === "get-signup-settings") {
      if (!isSuper) return forbid();
      return json(await signupSnapshot());
    }

    // Qaysi usullar bilan ro'yxatdan o'tish mumkin (login / email / telefon), email kodi va Telegram tasdiqlash
    if (action === "save-signup-settings") {
      if (!isSuper) return forbid();
      const cur = await getSignupCfg(admin);
      const pick = (k: string, old: boolean): boolean => (typeof body[k] === "boolean" ? (body[k] as boolean) : old);
      const next = {
        login: pick("login", cur.login),
        email: pick("email", cur.email),
        phone: pick("phone", cur.phone),
        emailCode: pick("emailCode", cur.emailCode),
        phoneTelegram: pick("phoneTelegram", cur.phoneTelegram),
        telegram: pick("telegram", cur.telegram),
      };
      if (!next.login && !next.email && !next.phone && !next.telegram) return json({ error: "Kamida bitta ro'yxatdan o'tish usuli yoqilgan bo'lishi kerak" }, 400);
      if ((next.phoneTelegram || next.telegram) && !tgReady(cur)) return json({ error: "Avval Telegram botni ulang (pastda bot tokenini kiriting)" }, 400);
      const onOff = (v: boolean) => (v ? "on" : "off");
      const { error } = await admin.from("secure_settings").upsert(
        [
          { key: "reg_login", value: onOff(next.login) },
          { key: "reg_email", value: onOff(next.email) },
          { key: "reg_phone", value: onOff(next.phone) },
          { key: "reg_telegram", value: onOff(next.telegram) },
          { key: "signup_email_code", value: onOff(next.emailCode) },
          { key: "signup_phone_telegram", value: onOff(next.phoneTelegram) },
        ],
        { onConflict: "key" },
      );
      if (error) return json({ error: error.message }, 400);
      return json(await signupSnapshot());
    }

    // Telegram botni ulash: token tekshiriladi (getMe), webhook avtomatik o'rnatiladi. Bo'sh token — botni uzish.
    if (action === "tg-save-bot") {
      if (!isSuper) return forbid();
      const cur = await getSignupCfg(admin);
      const token = String(body.token || "").trim();
      if (!token) {
        // Bot uzilganda Telegram usuli ham o'chadi — hech qanday usul qolmasa, uzishga ruxsat berilmaydi
        if (!cur.login && !cur.email && !cur.phone) return json({ error: "Avval boshqa ro'yxatdan o'tish usulini (login, email yoki telefon) yoqing, keyin botni uzing" }, 400);
        if (cur.tgToken) await tgCall(cur.tgToken, "deleteWebhook", {}).catch(() => {});
        await admin.from("secure_settings").upsert(
          [
            { key: "tg_bot_token", value: "" },
            { key: "tg_bot_username", value: "" },
            { key: "tg_webhook_secret", value: "" },
            { key: "signup_phone_telegram", value: "off" },
            { key: "reg_telegram", value: "off" },
          ],
          { onConflict: "key" },
        );
        return json(await signupSnapshot());
      }
      if (!/^\d{6,14}:[A-Za-z0-9_-]{30,}$/.test(token)) return json({ error: "Bot tokeni noto'g'ri ko'rinishda (namuna: 123456789:AAH…). @BotFather bergan tokenni to'liq nusxalang." }, 400);
      let me: { username?: string };
      try {
        me = await tgCall(token, "getMe", {});
      } catch (e) {
        return json({ error: `Telegram tokenni qabul qilmadi: ${(e as Error).message}` }, 400);
      }
      if (!me?.username) return json({ error: "Bot username'i aniqlanmadi" }, 400);
      const secret = randomToken(24);
      try {
        await tgCall(token, "setWebhook", {
          url: `${SUPABASE_URL}/functions/v1/admin`,
          secret_token: secret,
          allowed_updates: ["message"],
          drop_pending_updates: true,
        });
      } catch (e) {
        return json({ error: `Webhook o'rnatilmadi: ${(e as Error).message}` }, 400);
      }
      const { error } = await admin.from("secure_settings").upsert(
        [
          { key: "tg_bot_token", value: token },
          { key: "tg_bot_username", value: me.username },
          { key: "tg_webhook_secret", value: secret },
        ],
        { onConflict: "key" },
      );
      if (error) return json({ error: error.message }, 400);
      return json(await signupSnapshot());
    }

    // Botni tekshirish: token yaroqlimi va webhook shu funksiyaga ulanganmi
    if (action === "tg-check") {
      if (!isSuper) return forbid();
      const c = await getSignupCfg(admin);
      if (!tgReady(c)) return json({ ok: false, error: "Telegram bot hali ulanmagan" });
      try {
        const me = await tgCall(c.tgToken, "getMe", {});
        const info = await tgCall(c.tgToken, "getWebhookInfo", {});
        const expected = `${SUPABASE_URL}/functions/v1/admin`;
        return json({
          ok: true,
          username: me.username,
          webhookOk: info.url === expected,
          pending: info.pending_update_count || 0,
          lastError: info.last_error_message || "",
        });
      } catch (e) {
        return json({ ok: false, error: String((e as Error).message || e) });
      }
    }

    if (action === "save-mail-settings") {
      if (!isSuper) return forbid();
      const provider = String(body.provider || "brevo").toLowerCase();
      if (!["brevo", "resend"].includes(provider)) return json({ error: "Noma'lum provayder" }, 400);
      const from = normEmail(body.from);
      if (from && !EMAIL_RE.test(from)) return json({ error: "Yuboruvchi email manzili noto'g'ri" }, 400);
      const rows: { key: string; value: string }[] = [
        { key: "mail_provider", value: provider },
        { key: "mail_from", value: from },
        { key: "mail_from_name", value: String(body.fromName || "Til sayohati").trim().slice(0, 60) || "Til sayohati" },
      ];
      const apiKey = String(body.apiKey || "").trim();
      if (apiKey) rows.push({ key: "mail_api_key", value: apiKey });
      const { error } = await admin.from("secure_settings").upsert(rows, { onConflict: "key" });
      if (error) return json({ error: error.message }, 400);
      const cfg = await getMailConfig(admin);
      return json({ ok: true, configured: !!(cfg.apiKey && cfg.from), maskedKey: cfg.apiKey ? maskKey(cfg.apiKey) : "" });
    }

    if (action === "test-mail") {
      if (!isSuper) return forbid();
      const to = normEmail(body.to);
      if (!EMAIL_RE.test(to)) return json({ error: "Email manzili noto'g'ri" }, 400);
      const cfg = await getMailConfig(admin);
      if (!cfg.apiKey || !cfg.from) return json({ error: "Avval API kalit va yuboruvchi emailni saqlang" }, 400);
      const started = Date.now();
      try {
        const m = codeMail("123456", "register");
        await sendMail(cfg, to, "Test: " + m.subject, m.html, m.text);
        return json({ ok: true, latencyMs: Date.now() - started });
      } catch (e) {
        return json({ ok: false, error: String((e as Error).message || e) });
      }
    }

    // =====================================================================
    // API KALITLAR (qiymat hech qachon to'liq qaytarilmaydi — faqat maskalangan)
    // =====================================================================
    if (action === "list-api-keys") {
      if (!can("ai_view")) return forbid();
      const { data: keys, error } = await admin
        .from("api_keys")
        .select("id, provider, label, key_value, base_url, model, priority, is_active, failure_count, success_count, last_used_at, last_error, created_at")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({
        keys: (keys || []).map((k) => ({
          id: k.id,
          provider: k.provider,
          label: k.label,
          maskedKey: maskKey(k.key_value as string),
          baseUrl: k.base_url,
          model: k.model,
          priority: k.priority,
          isActive: k.is_active,
          failureCount: k.failure_count,
          successCount: k.success_count,
          lastUsedAt: k.last_used_at,
          lastError: k.last_error,
          createdAt: k.created_at,
        })),
      });
    }

    if (action === "add-api-key") {
      if (!isSuper) return forbid();
      const keyValue = String(body.keyValue || "").trim();
      const provider = String(body.provider || "gemini").trim().toLowerCase();
      if (!PROVIDERS.includes(provider)) return json({ error: "Noma'lum provayder" }, 400);
      if (keyValue.length < 10) return json({ error: "API kalit noto'g'ri ko'rinadi (juda qisqa)" }, 400);
      const baseUrl = body.baseUrl ? String(body.baseUrl).trim().replace(/\/+$/, "") : null;
      if (provider === "custom" && !baseUrl) return json({ error: "Custom provayder uchun Base URL kerak" }, 400);
      const { data, error } = await admin.from("api_keys").insert({
        provider,
        label: body.label ? String(body.label).trim().slice(0, 100) : null,
        key_value: keyValue,
        base_url: baseUrl,
        model: body.model ? String(body.model).trim().slice(0, 120) : null,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100,
        is_active: true,
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data?.id });
    }

    if (action === "update-api-key") {
      if (!isSuper) return forbid();
      if (!body.id) return json({ error: "id kerak" }, 400);
      const patch: Record<string, unknown> = {};
      if (body.label !== undefined) patch.label = String(body.label).slice(0, 100) || null;
      if (body.model !== undefined) patch.model = String(body.model).trim() || null;
      if (body.baseUrl !== undefined) patch.base_url = String(body.baseUrl).trim().replace(/\/+$/, "") || null;
      if (body.priority !== undefined) patch.priority = Number(body.priority) || 100;
      if (body.keyValue) patch.key_value = String(body.keyValue).trim();
      const { error } = await admin.from("api_keys").update(patch).eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "toggle-api-key") {
      if (!isSuper) return forbid();
      if (!body.id) return json({ error: "id kerak" }, 400);
      const { error } = await admin
        .from("api_keys")
        .update({ is_active: Boolean(body.isActive), failure_count: 0, last_error: null })
        .eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete-api-key") {
      if (!isSuper) return forbid();
      if (!body.id) return json({ error: "id kerak" }, 400);
      const { error } = await admin.from("api_keys").delete().eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Noma'lum amal (action)" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
