// Edge Function: /functions/v1/admin
// Admin / super admin amallari: foydalanuvchi va admin qo'shish/o'chirish, rol
// berish, parolni tiklash, bloklash, AI sozlamalari va API kalitlarni boshqarish.
// Bular Auth Admin API yoki maxfiy jadvallarga (api_keys) kirishni talab qilgani
// uchun klientdan emas, shu funksiya orqali (service-role kalit bilan) bajariladi.
//
// So'rov: POST { action, ...payload }   Header: Authorization: Bearer <sessiya tokeni>
// Istisno: action "login" — tokensiz (email, telefon yoki login + parol bilan kirish).
//
// Eslatma: fayl ATAYLAB hech qanday nisbiy importga ega emas — Supabase
// Dashboard'dagi muharrir orqali (CLI'siz) joylashtirilganda ham ishlaydi.

import { createClient } from "npm:@supabase/supabase-js@2";

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
    // Ochiq amal (tokensiz): kirish
    const peek = await req.clone().json().catch(() => ({}));
    if (peek?.action === "login") return await handleLogin(peek);

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

    /** Chaqiruvchi shu foydalanuvchini boshqara oladimi (super admin hammani, admin faqat o'quvchilarni). */
    function canManage(target: Profile) {
      if (target.role === "superadmin") return false;
      if (target.role === "admin") return isSuper;
      return isStaff;
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
      if (!isStaff) return forbid();
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
      if (!isStaff) return forbid();
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

    // superadmin: 'user' yoki 'admin' yaratadi; admin: faqat 'user'
    if (action === "create-user" || action === "create-admin") {
      if (!isStaff) return forbid();
      const role = action === "create-admin" || body.role === "admin" ? "admin" : "user";
      if (role === "admin" && !isSuper) return json({ error: "Admin qo'shish faqat super admin uchun" }, 403);
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
      if (!isStaff) return forbid();
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
      if (!isStaff) return forbid();
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
      if (!isStaff) return forbid();
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
      return json({ users: (roles || []).length, byRole, newThisWeek, activeToday, mediaByKind, aiToday, activeKeys: keyCount || 0 });
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
