// Edge Function: /functions/v1/admin
// Admin / super admin amallari: foydalanuvchi va admin qo'shish/o'chirish, rol
// berish, parolni tiklash, bloklash, AI sozlamalari va API kalitlarni boshqarish.
// Bular Auth Admin API yoki maxfiy jadvallarga (api_keys) kirishni talab qilgani
// uchun klientdan emas, shu funksiya orqali (service-role kalit bilan) bajariladi.
//
// So'rov: POST { action, ...payload }   Header: Authorization: Bearer <sessiya tokeni>
// Ochiq (tokensiz) amallar: "login" (email/telefon/login + parol), "send-email-code" (emailga 6 xonali kod),
// "register" (email — kod bilan tasdiqlanadi, telefon — kodsiz), "reset-with-code" (parolni kod bilan tiklash).
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
    lastSeenAt: p.last_seen_at,
    createdAt: p.created_at,
    ...extra,
  };
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

const PUBLIC_ACTIONS = new Set(["login", "send-email-code", "register", "reset-with-code"]);

/** Tokensiz (yoki o'z tokeni bilan) ishlaydigan ochiq amallar: kirish, kod yuborish, ro'yxatdan o'tish, parolni tiklash. */
async function handlePublic(action: string, body: Record<string, unknown>, req: Request): Promise<Response> {
  if (action === "login") return await handleLogin(body);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ip = clientIp(req);

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

  // ---------- Ro'yxatdan o'tish (email — kod bilan, telefon — kodsiz) ----------
  if (action === "register") {
    if (!(await allow(admin, `reg:${ip}`, 20, 3_600_000))) return json({ error: "Juda ko'p urinish. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    const email = normEmail(body.email);
    const phoneRaw = String(body.phone || "").trim();
    const hasPhone = phoneRaw.replace(/\D/g, "").length > 3;
    const password = String(body.password || "");
    if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, 400);
    if (!email && !hasPhone) return json({ error: "Email yoki telefon raqamidan kamida bittasini kiriting" }, 400);

    let phone: string | null = null;
    if (hasPhone) {
      const d = normalizePhone(phoneRaw);
      if (!d) return json({ error: "Telefon raqamini to'g'ri kiriting (masalan: +998 90 123 45 67)" }, 400);
      phone = "+" + d;
      const { data: taken } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
      if (taken) return json({ error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning." }, 400);
    }

    let authEmail: string;
    let username: string;
    if (email) {
      if (!EMAIL_RE.test(email) || email.endsWith("@" + SYNTH_DOMAIN)) return json({ error: "Email manzili noto'g'ri" }, 400);
      if (await emailTaken(admin, email)) return json({ error: "Bu email allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning." }, 400);
      const bad = await verifyCode(admin, email, "register", body.code);
      if (bad) return json({ error: bad, codeError: true }, 400);
      authEmail = email;
      username = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 30) || "user";
    } else {
      const d = phone!.slice(1);
      authEmail = `tel${d}@${SYNTH_DOMAIN}`;
      username = d;
    }
    const displayName = String(body.displayName || "").trim().slice(0, 60) || username;

    const { error } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName, phone: phone || undefined },
    });
    if (error) {
      const msg = /already|registered|exists/i.test(error.message) ? "Bu email yoki telefon allaqachon ro'yxatdan o'tgan" : error.message;
      return json({ error: msg }, 400);
    }
    return json({ ok: true, email: authEmail });
  }

  // ---------- Parolni kod bilan tiklash ----------
  if (action === "reset-with-code") {
    if (!(await allow(admin, `rst:${ip}`, 20, 3_600_000))) return json({ error: "Juda ko'p urinish. Bir ozdan keyin qayta urinib ko'ring." }, 429);
    const email = normEmail(body.email);
    const password = String(body.password || "");
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
    const { data: callerProfile } = await admin.from("profiles").select("role, is_blocked").eq("id", user.id).single();
    const callerRole = (callerProfile?.role as string) || "user";
    if (callerProfile?.is_blocked) return json({ error: "Hisobingiz bloklangan" }, 403);
    const isStaff = callerRole === "admin" || callerRole === "superadmin";
    const isSuper = callerRole === "superadmin";

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const forbid = () => json({ error: "Bu amal uchun ruxsatingiz yo'q" }, 403);

    async function getTarget(id: string) {
      const { data } = await admin.from("profiles").select("*").eq("id", id).single();
      return data as Profile | null;
    }

    // Foydalanuvchilar ro'yxati va ularni boshqarish — FAQAT super admin uchun.
    // Oddiy admin (masalan o'qituvchi) materiallar va AI bilan ishlay oladi, lekin foydalanuvchilarni ko'rmaydi.
    const superOnly = () => json({ error: "Foydalanuvchilar bo'limi faqat super admin uchun" }, 403);

    /** Super admin o'zidan boshqa hammani boshqara oladi; super adminning o'zini — hech kim. */
    function canManage(target: Profile) {
      return isSuper && target.role !== "superadmin";
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
            // Yangi emailni faqat emailga yuborilgan kod orqali tasdiqlagan foydalanuvchi o'rnata oladi
            const bad = await verifyCode(admin, e, "change-email", body.emailCode);
            if (bad) return json({ error: bad, codeError: true }, 400);
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
      if (!isSuper) return superOnly();
      const { data: profiles, error } = await admin.from("profiles").select("*").order("created_at", { ascending: true });
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
      if (!isSuper) return superOnly();
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      const { data: prog } = await admin
        .from("progress")
        .select("state, updated_at")
        .eq("user_id", target.id as string)
        .maybeSingle();
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await admin.from("ai_usage").select("count").eq("user_id", target.id as string).eq("day", today).maybeSingle();
      return json({ user: publicUser(target), progress: prog?.state || {}, progressUpdatedAt: prog?.updated_at || null, aiUsedToday: usage?.count || 0 });
    }

    // Faqat super admin: 'user' yoki 'admin' yaratadi
    if (action === "create-user" || action === "create-admin") {
      if (!isSuper) return superOnly();
      const role = action === "create-admin" || body.role === "admin" ? "admin" : "user";
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
      if (role !== "user") await admin.from("profiles").update({ role }).eq("id", uid);
      const prof = await getTarget(uid);
      return json({ user: publicUser(prof || { id: uid, username: ident.username, display_name: displayName, role }) });
    }

    if (action === "delete-user" || action === "delete-admin") {
      if (!isSuper) return superOnly();
      const targetId = String(body.id || "");
      if (targetId === user.id) return json({ error: "O'zingizni o'chira olmaysiz" }, 400);
      const target = await getTarget(targetId);
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
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
      const { error } = await admin.from("profiles").update({ role }).eq("id", target.id as string);
      if (error) return json({ error: error.message }, 400);
      return json({ user: publicUser({ ...target, role }) });
    }

    if (action === "reset-password") {
      if (!isSuper) return superOnly();
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (target.id !== user.id && !canManage(target)) return forbid();
      const password = String(body.password || "");
      if (password.length < 6) return json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.id as string, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "block-user") {
      if (!isSuper) return superOnly();
      const target = await getTarget(String(body.id || ""));
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
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
      if (!isStaff) return forbid();
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
      if (!isStaff) return forbid();
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
      if (!isStaff) return forbid();
      const cfg = await getMailConfig(admin);
      return json({
        provider: cfg.provider,
        from: cfg.from,
        fromName: cfg.fromName,
        hasKey: !!cfg.apiKey,
        maskedKey: cfg.apiKey ? maskKey(cfg.apiKey) : "",
        configured: !!(cfg.apiKey && cfg.from),
      });
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
      if (!isStaff) return forbid();
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
