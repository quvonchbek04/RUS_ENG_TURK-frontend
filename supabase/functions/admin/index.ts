// Edge Function: /functions/v1/admin
// Superadmin (va ba'zi amallar uchun admin) huquqi talab qiladigan amallar —
// bular Auth Admin API yoki maxfiy sozlamalarga (secure_settings) kirishni
// talab qilgani uchun klientdan to'g'ridan-to'g'ri emas, shu Edge Function
// orqali (service-role kalit bilan) bajariladi.
//
// So'rov formati: POST { action: "create-admin" | "delete-admin" |
//                          "get-ai-settings" | "save-ai-settings", ...payload }
// Header: Authorization: Bearer <foydalanuvchining supabase session tokeni>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function publicUser(p: Record<string, unknown>) {
  return { id: p.id, username: p.username, displayName: p.display_name, role: p.role, createdAt: p.created_at };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Faqat POST so'rovlar qabul qilinadi" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Kirish talab qilinadi" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    const callerRole = callerProfile?.role || "user";

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ---------- Yangi admin yaratish (faqat superadmin) ----------
    if (action === "create-admin") {
      if (callerRole !== "superadmin") return json({ error: "Bu amal uchun ruxsatingiz yo'q" }, 403);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const displayName = body.displayName ? String(body.displayName) : username;
      if (username.length < 3 || password.length < 4) {
        return json({ error: "Foydalanuvchi nomi kamida 3, parol kamida 4 belgidan iborat bo'lishi kerak" }, 400);
      }
      const email = `${username.toLowerCase()}@til-sayohati.local`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName, role: "admin" },
      });
      if (error) {
        const msg = /already|registered|exists/i.test(error.message) ? "Bu foydalanuvchi nomi band" : error.message;
        return json({ error: msg }, 400);
      }
      // Trigger 'user' bilan yaratadi — buni 'admin'ga ko'taramiz
      await admin.from("profiles").update({ role: "admin" }).eq("id", created.user!.id);
      const { data: prof } = await admin.from("profiles").select("*").eq("id", created.user!.id).single();
      return json({ user: publicUser(prof!) });
    }

    // ---------- Adminni o'chirish (faqat superadmin) ----------
    if (action === "delete-admin") {
      if (callerRole !== "superadmin") return json({ error: "Bu amal uchun ruxsatingiz yo'q" }, 403);
      const targetId = String(body.id || "");
      const { data: target } = await admin.from("profiles").select("role").eq("id", targetId).single();
      if (!target) return json({ error: "Foydalanuvchi topilmadi" }, 404);
      if (target.role === "superadmin") return json({ error: "Super adminni o'chirib bo'lmaydi" }, 400);
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- AI sozlamalarini o'qish (admin + superadmin) ----------
    if (action === "get-ai-settings") {
      if (!["admin", "superadmin"].includes(callerRole)) return json({ error: "Bu amal uchun ruxsatingiz yo'q" }, 403);
      const { data: providerRow } = await admin.from("settings").select("value").eq("key", "ai_provider").single();
      const { data: keyRow } = await admin.from("secure_settings").select("value").eq("key", "gemini_api_key").single();
      const configuredProvider = (providerRow?.value || "mock").toLowerCase();
      const hasKey = Boolean(keyRow?.value);
      const provider = configuredProvider === "gemini" && hasKey ? "gemini" : "mock";
      return json({ provider, hasKey, configuredProvider });
    }

    // ---------- AI sozlamalarini saqlash (faqat superadmin) ----------
    if (action === "save-ai-settings") {
      if (callerRole !== "superadmin") return json({ error: "Bu amal uchun ruxsatingiz yo'q" }, 403);
      const { geminiApiKey, provider } = body;
      if (provider && !["mock", "gemini"].includes(String(provider).toLowerCase())) {
        return json({ error: "Noto'g'ri provayder qiymati" }, 400);
      }
      if (typeof geminiApiKey === "string") {
        await admin.from("secure_settings").update({ value: geminiApiKey.trim() }).eq("key", "gemini_api_key");
      }
      if (provider) {
        await admin.from("settings").update({ value: String(provider).toLowerCase() }).eq("key", "ai_provider");
      }
      const { data: providerRow } = await admin.from("settings").select("value").eq("key", "ai_provider").single();
      const { data: keyRow } = await admin.from("secure_settings").select("value").eq("key", "gemini_api_key").single();
      const configuredProvider = (providerRow?.value || "mock").toLowerCase();
      const hasKey = Boolean(keyRow?.value);
      const activeProvider = configuredProvider === "gemini" && hasKey ? "gemini" : "mock";
      return json({ provider: activeProvider, hasKey, configuredProvider });
    }

    return json({ error: "Noma'lum amal (action)" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
