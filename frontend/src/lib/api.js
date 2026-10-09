import { supabase, setRemember } from './supabase.js';
import { SYNTH_DOMAIN, isSyntheticEmail, isValidEmail, normalizePhone, resolveIdentifier, formatPhone } from './identity.js';

// ============================================================================
// Ilovaning barcha ma'lumot almashinuvi shu yerda: Supabase (Auth, Postgres,
// Storage, Edge Functions) va statik kurs kontenti (public/content/*.json).
// ============================================================================

export const LANG_KEYS = ['en', 'ru', 'tr'];
export const MEDIA_KINDS = ['audio', 'video', 'image', 'text', 'dialog', 'vocab', 'news'];
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Yordamchilar
// ---------------------------------------------------------------------------
function throwIfError(error) {
  if (!error) return;
  if (/failed to fetch|networkerror|load failed/i.test(error.message || '')) {
    throw new Error("Server bilan aloqa yo'q. Internet ulanishini tekshirib, qayta urinib ko'ring.");
  }
  if (/relation .* does not exist|could not find the table/i.test(error.message || '')) {
    throw new Error("Bazada kerakli jadval topilmadi — supabase/migrations dagi SQL fayllarni ishga tushiring.");
  }
  throw new Error(error.message || "Supabase so'rovida xatolik yuz berdi");
}

export function publicProfile(p) {
  if (!p) return null;
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
  };
}

export function publicMedia(m) {
  return {
    id: m.id,
    kind: m.kind,
    lang: m.lang,
    title: m.title,
    description: m.description,
    storagePath: m.storage_path,
    fileUrl: m.file_url,
    mime: m.mime,
    sizeBytes: m.size_bytes,
    content: m.content || {},
    lessonRef: m.lesson_ref,
    position: m.position,
    isPublished: m.is_published,
    uploadedBy: m.uploaded_by,
    createdAt: m.created_at,
  };
}

/** Edge Function chaqiruvi — server qaytargan ANIQ xato matnini ko'rsatadi
 *  (supabase-js'ning umumiy "non-2xx status code" xabari o'rniga). */
async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let serverMessage = null;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const parsed = await error.context.clone().json();
        serverMessage = parsed && parsed.error ? String(parsed.error) : null;
      } catch {
        try {
          serverMessage = await error.context.clone().text();
        } catch {
          /* e'tiborsiz */
        }
      }
    }
    if (!serverMessage && /Failed to send|fetch/i.test(error.message || '')) {
      serverMessage = `"${name}" Edge Function'ga ulanib bo'lmadi. Funksiya Supabase'ga joylanganini tekshiring.`;
    }
    throw new Error(serverMessage || error.message || "Server bilan bog'lanishda xato yuz berdi");
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function currentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Kirish talab qilinadi');
  return session.user;
}

async function fetchProfile(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  throwIfError(error);
  return data;
}

function authErrorMessage(error, fallback) {
  const m = String(error?.message || '');
  if (/already|registered|exists/i.test(m)) return "Bu email yoki telefon raqami allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning.";
  if (/password.*(at least|short|characters)/i.test(m)) return "Parol juda qisqa — kamida 6 ta belgi kiriting.";
  if (/weak/i.test(m)) return "Parol juda oddiy — harf va raqamlardan iborat murakkabroq parol tanlang.";
  if (/rate|too many|security purposes/i.test(m)) return "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urinib ko'ring.";
  if (/not confirmed/i.test(m)) return 'Email manzilingiz hali tasdiqlanmagan. Pochtangizdagi xatni oching.';
  if (/banned/i.test(m)) return 'Hisobingiz bloklangan. Administrator bilan bog\'laning.';
  if (/invalid.*email|email.*invalid/i.test(m)) return "Email manzili noto'g'ri.";
  if (/signups? not allowed|disabled/i.test(m)) return "Ro'yxatdan o'tish vaqtincha o'chirilgan (Supabase sozlamasi).";
  return fallback || m || 'Xatolik yuz berdi';
}

// ---------------------------------------------------------------------------
// KURS KONTENTI (statik fayllar: public/content/meta.json, en.json, ru.json, tr.json)
// ---------------------------------------------------------------------------
let metaPromise = null;
const langPromises = {};
let uploadedCache = {}; // lang -> { at, data }

async function fetchJson(url) {
  // Netlify statik fayllarni ETag bilan beradi — brauzer yangilanganini tekshirib, o'zgarmagan bo'lsa keshdan oladi
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kurs kontenti yuklanmadi (${url})`);
  return res.json();
}

export function loadMeta() {
  if (!metaPromise) {
    metaPromise = fetchJson('/content/meta.json').catch((e) => {
      metaPromise = null;
      throw e;
    });
  }
  return metaPromise;
}

/** Til faylini yuklab, darslardagi so'z/ibora havolalarini ([bo'lim, qator]) haqiqiy
 *  qatorlarga aylantiradi: [so'z, tarjima, gap, gap tarjimasi, bo'lim raqami]. */
function loadLangFile(lang) {
  if (!langPromises[lang]) {
    langPromises[lang] = fetchJson(`/content/${lang}.json`)
      .then((raw) => {
        const wordbank = raw.wordbank || [];
        const phrasebank = raw.phrasebank || [];
        const resolve = (bank, refs) =>
          (refs || [])
            .map(([s, r]) => {
              const row = bank[s]?.rows?.[r];
              return row ? [row[0], row[1], row[2], row[3], s] : null;
            })
            .filter(Boolean);
        const modules = (raw.modules || []).map((mod) => ({
          ...mod,
          months: mod.months.map((m) => ({ ...m, words: resolve(wordbank, m.words), phrases: resolve(phrasebank, m.phrases) })),
        }));
        return { ...raw, modules, wordbank, phrasebank };
      })
      .catch((e) => {
        delete langPromises[lang];
        throw e;
      });
  }
  return langPromises[lang];
}

/** Yuklangan lug'at va dialoglar (60 soniya keshlanadi). */
async function loadUploaded(lang) {
  const c = uploadedCache[lang];
  if (c && Date.now() - c.at < 60_000) return c.data;
  let data = { vocab: [], dialogs: [] };
  try {
    const query = supabase
      .from('media_items')
      .select('id, kind, lang, title, description, content, lesson_ref, file_url, position, created_at')
      .in('kind', ['vocab', 'dialog'])
      .in('lang', [lang, 'all'])
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    // Tarmoq sekin bo'lsa ham darslar kutib qolmasin — 3.5 soniyadan keyin yuklanganlarsiz davom etamiz
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500));
    const { data: rows } = await Promise.race([query, timeout]);
    const items = (rows || []).map(publicMedia);
    data = { vocab: items.filter((i) => i.kind === 'vocab'), dialogs: items.filter((i) => i.kind === 'dialog') };
  } catch {
    /* jadval hali yaratilmagan bo'lishi mumkin — statik kontent baribir ishlaydi */
  }
  uploadedCache[lang] = { at: Date.now(), data };
  return data;
}

export function invalidateMediaCache() {
  uploadedCache = {};
  countsCache = null;
}

let countsCache = null;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const api = {
  // ---------------- AUTH ----------------
  /** Email va/yoki telefon bilan ro'yxatdan o'tish (kamida bittasi kerak).
   *  Ikkalasi kiritilsa — keyin istalgani bilan kirish mumkin. */
  register: async ({ email, phone, password, displayName }) => {
    if (String(password || '').length < 6) throw new Error("Parol kamida 6 belgidan iborat bo'lishi kerak");
    const e = String(email || '').trim().toLowerCase();
    const phoneRaw = String(phone || '').trim();
    const hasPhone = phoneRaw.replace(/\D/g, '').length > 3; // "+998 " yolg'iz qolsa — bo'sh hisoblanadi
    if (!e && !hasPhone) throw new Error('Email yoki telefon raqamidan kamida bittasini kiriting');

    const meta = {};
    let d = null;
    if (hasPhone) {
      d = normalizePhone(phoneRaw);
      if (!d) throw new Error("Telefon raqamini to'g'ri kiriting (masalan: +998 90 123 45 67)");
      meta.phone = '+' + d;
      const { data: available, error: rpcErr } = await supabase.rpc('phone_available', { p_phone: meta.phone });
      if (!rpcErr && available === false) {
        throw new Error("Bu telefon raqami allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning.");
      }
    }
    let authEmail;
    if (e) {
      if (!isValidEmail(e)) throw new Error("Email manzilini to'g'ri kiriting (masalan: ism@gmail.com)");
      if (isSyntheticEmail(e)) throw new Error("Bu email manzilidan foydalanib bo'lmaydi");
      authEmail = e;
      meta.username = e.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30) || 'user';
    } else {
      authEmail = `tel${d}@${SYNTH_DOMAIN}`;
      meta.username = d;
    }
    meta.display_name = String(displayName || '').trim() || (d ? formatPhone(d) : meta.username);
    setRemember(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: { data: meta, emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw new Error(authErrorMessage(error));
    // Email tasdiqlash yoqilgan bo'lsa va email band bo'lsa Supabase "bo'sh" user qaytaradi
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("Bu email allaqachon ro'yxatdan o'tgan. Kirish sahifasidan foydalaning.");
    }
    if (!data.session) return { needsConfirmation: true, email: authEmail };
    const profile = await fetchProfile(data.user.id);
    return { user: publicProfile(profile) };
  },

  login: async ({ identifier, password, remember = true }) => {
    const ident = resolveIdentifier(identifier);
    if (!ident) throw new Error("Email, telefon raqami yoki loginni to'g'ri kiriting");
    setRemember(remember);
    let { data, error } = await supabase.auth.signInWithPassword({ email: ident.email, password });
    const invalid = error && /invalid login|invalid credentials/i.test(error.message || '');
    if (invalid && ident.kind !== 'email') {
      // Telefon yoki login bilan kirilyapti, lekin hisob email bilan ochilgan bo'lishi mumkin —
      // server (Edge Function) telefon/login bo'yicha emailni topib, kirishni o'zi bajaradi.
      const { data: fn, error: fnErr } = await supabase.functions.invoke('admin', {
        body: { action: 'login', identifier, password },
      });
      if (fn?.session) {
        const res = await supabase.auth.setSession(fn.session);
        data = res.data;
        error = res.error;
      } else {
        let msg = fn?.error || null;
        if (!msg && fnErr?.context && typeof fnErr.context.json === 'function') {
          try {
            msg = (await fnErr.context.clone().json())?.error || null;
          } catch {
            /* e'tiborsiz */
          }
        }
        throw new Error(msg || "Login (email/telefon) yoki parol noto'g'ri");
      }
    }
    if (error) {
      if (/invalid login|invalid credentials/i.test(error.message || '')) {
        throw new Error("Login (email/telefon) yoki parol noto'g'ri");
      }
      throw new Error(authErrorMessage(error, "Kirishda xatolik yuz berdi"));
    }
    const profile = await fetchProfile(data.user.id);
    if (profile?.is_blocked) {
      await supabase.auth.signOut();
      throw new Error("Hisobingiz bloklangan. Administrator bilan bog'laning.");
    }
    return { user: publicProfile(profile) };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  me: async () => {
    const user = await currentUser();
    const profile = await fetchProfile(user.id);
    // Oxirgi faollik vaqtini (10 daqiqada bir marta) yangilaymiz — admin statistikasi uchun
    const last = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
    if (Date.now() - last > 10 * 60_000) {
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id).then(() => {});
    }
    return { user: publicProfile(profile) };
  },

  requestPasswordReset: async (email) => {
    const e = String(email || '').trim().toLowerCase();
    if (!isValidEmail(e) || isSyntheticEmail(e)) {
      throw new Error("Parolni tiklash faqat email bilan ro'yxatdan o'tganlar uchun. Telefon orqali o'tgan bo'lsangiz, administratorga murojaat qiling.");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) throw new Error(authErrorMessage(error));
    return { ok: true };
  },

  updatePassword: async (password) => {
    if (String(password || '').length < 6) throw new Error("Parol kamida 6 belgidan iborat bo'lishi kerak");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(authErrorMessage(error));
    return { ok: true };
  },

  /** O'z email/telefonini qo'shish yoki almashtirish (server tomonda tekshiriladi). */
  updateContact: async ({ email, phone }) => {
    const payload = { action: 'update-my-contact' };
    if (email !== undefined) payload.email = email;
    if (phone !== undefined) payload.phone = phone;
    return callFunction('admin', payload);
  },

  updateProfile: async ({ displayName }) => {
    const user = await currentUser();
    const name = String(displayName || '').trim().slice(0, 60);
    if (!name) throw new Error("Ism bo'sh bo'lmasligi kerak");
    const { data, error } = await supabase.from('profiles').update({ display_name: name }).eq('id', user.id).select('*').single();
    throwIfError(error);
    return { user: publicProfile(data) };
  },

  // ---------------- KURS KONTENTI ----------------
  langs: async () => {
    const meta = await loadMeta();
    return { langs: meta.LANGS, tabs: meta.TABS };
  },

  meta: () => loadMeta(),

  content: async (lang) => {
    if (!LANG_KEYS.includes(lang)) throw new Error('Til topilmadi');
    const [meta, file, uploaded] = await Promise.all([loadMeta(), loadLangFile(lang), loadUploaded(lang)]);
    const uploadedCategories = uploaded.vocab.map((v) => ({
      cat: `📤 ${v.title}`,
      level: 'yuklangan',
      words: v.content.words || [],
      mediaId: v.id,
    }));
    return {
      meta: meta.LANGS[lang],
      wordCats: meta.wordCats || [],
      phraseCats: meta.phraseCats || [],
      modules: file.modules,
      dictExtra: [...(file.dictExtra || []), ...uploadedCategories],
      verbTable: file.verbTable || [],
      dialogsExtra: file.dialogsExtra || [],
      wordbank: file.wordbank,
      phrasebank: file.phrasebank,
      uploadedVocab: uploaded.vocab,
      uploadedDialogs: uploaded.dialogs,
    };
  },

  // ---------------- PROGRESS ----------------
  getProgress: async () => {
    const user = await currentUser();
    const { data, error } = await supabase.from('progress').select('state, updated_at').eq('user_id', user.id).maybeSingle();
    throwIfError(error);
    return { state: data?.state || {}, updatedAt: data?.updated_at };
  },

  putProgress: async (state) => {
    const user = await currentUser();
    const { error } = await supabase
      .from('progress')
      .upsert({ user_id: user.id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    throwIfError(error);
    return { ok: true };
  },

  // ---------------- MEDIA (musiqa, video, rasm, matn, dialog, lug'at, yangilik) ----------------
  listMedia: async ({ kind, lang, lessonRef } = {}) => {
    let q = supabase.from('media_items').select('*');
    if (kind) q = q.eq('kind', kind);
    if (lang && lang !== 'all') q = q.in('lang', [lang, 'all']);
    if (lessonRef) q = q.eq('lesson_ref', lessonRef);
    q = q.order('position', { ascending: true }).order('created_at', { ascending: true });
    const { data, error } = await q;
    throwIfError(error);
    return (data || []).map(publicMedia);
  },

  latestNews: async (limit = 3) => {
    const { data, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('kind', 'news')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || []).map(publicMedia);
  },

  mediaCounts: async () => {
    if (countsCache && Date.now() - countsCache.at < 60_000) return countsCache.data;
    const counts = {};
    try {
      const { data } = await supabase.from('media_items').select('kind');
      (data || []).forEach((r) => (counts[r.kind] = (counts[r.kind] || 0) + 1));
    } catch {
      /* jadval yo'q */
    }
    countsCache = { at: Date.now(), data: counts };
    return counts;
  },

  createMedia: async ({ kind, lang = 'all', title, description, lessonRef, content = {}, file, isPublished = true }) => {
    if (!MEDIA_KINDS.includes(kind)) throw new Error("Noma'lum material turi");
    const cleanTitle = String(title || '').trim().slice(0, 300);
    if (!cleanTitle) throw new Error('Sarlavha kerak');
    const user = await currentUser();
    const { data: prof } = await supabase.from('profiles').select('username').eq('id', user.id).single();

    let storagePath = null;
    let fileUrl = null;
    let mime = null;
    let size = null;
    if (file) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`"${file.name}" juda katta (maksimal 50 MB)`);
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      storagePath = `${kind}/${new Date().toISOString().slice(0, 7)}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('media')
        .upload(storagePath, file, { contentType: file.type || undefined, cacheControl: '31536000', upsert: false });
      if (upErr) {
        throw new Error(
          /bucket/i.test(upErr.message)
            ? "Storage'da \"media\" bucket topilmadi — 0005_v2_platform.sql migratsiyasini ishga tushiring."
            : `Fayl yuklanmadi: ${upErr.message}`
        );
      }
      fileUrl = supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl;
      mime = file.type || ext;
      size = file.size;
    }

    const { data: last } = await supabase
      .from('media_items')
      .select('position')
      .eq('kind', kind)
      .order('position', { ascending: false })
      .limit(1);
    const position = (last?.[0]?.position ?? 0) + 10;

    const { data, error } = await supabase
      .from('media_items')
      .insert({
        kind,
        lang,
        title: cleanTitle,
        description: description ? String(description).slice(0, 2000) : null,
        storage_path: storagePath,
        file_url: fileUrl,
        mime,
        size_bytes: size,
        content,
        lesson_ref: lessonRef || null,
        position,
        is_published: isPublished,
        created_by: user.id,
        uploaded_by: prof?.username || null,
      })
      .select('*')
      .single();
    if (error) {
      if (storagePath) await supabase.storage.from('media').remove([storagePath]);
      throwIfError(error);
    }
    invalidateMediaCache();
    return publicMedia(data);
  },

  updateMedia: async (id, patch) => {
    const row = {};
    if (patch.title !== undefined) row.title = String(patch.title).slice(0, 300);
    if (patch.description !== undefined) row.description = patch.description || null;
    if (patch.lang !== undefined) row.lang = patch.lang;
    if (patch.lessonRef !== undefined) row.lesson_ref = patch.lessonRef || null;
    if (patch.content !== undefined) row.content = patch.content;
    if (patch.position !== undefined) row.position = patch.position;
    if (patch.isPublished !== undefined) row.is_published = patch.isPublished;
    row.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('media_items').update(row).eq('id', id).select('*').single();
    throwIfError(error);
    invalidateMediaCache();
    return publicMedia(data);
  },

  deleteMedia: async (item) => {
    if (item.storagePath) await supabase.storage.from('media').remove([item.storagePath]);
    const { error } = await supabase.from('media_items').delete().eq('id', item.id);
    throwIfError(error);
    invalidateMediaCache();
    return { ok: true };
  },

  /** Ro'yxat tartibini saqlaydi (har bir elementga 10, 20, 30 … pozitsiya beriladi). */
  reorderMedia: async (orderedItems) => {
    const updates = orderedItems
      .map((item, i) => ({ item, position: (i + 1) * 10 }))
      .filter(({ item, position }) => item.position !== position);
    await Promise.all(updates.map(({ item, position }) => supabase.from('media_items').update({ position }).eq('id', item.id)));
    invalidateMediaCache();
    return orderedItems.map((item, i) => ({ ...item, position: (i + 1) * 10 }));
  },

  // ---------------- ADMIN ----------------
  listAdminUsers: async () => {
    try {
      return await callFunction('admin', { action: 'list-users' });
    } catch {
      // Edge Function joylanmagan bo'lsa — kamida profillar ro'yxatini ko'rsatamiz
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      throwIfError(error);
      return { users: (data || []).map(publicProfile), limited: true };
    }
  },
  userDetail: (id) => callFunction('admin', { action: 'user-detail', id }),
  adminStats: () => callFunction('admin', { action: 'stats' }),
  createUser: (payload) => callFunction('admin', { action: 'create-user', ...payload }),
  deleteUser: (id) => callFunction('admin', { action: 'delete-user', id }),
  setRole: (id, role) => callFunction('admin', { action: 'set-role', id, role }),
  resetUserPassword: (id, password) => callFunction('admin', { action: 'reset-password', id, password }),
  blockUser: (id, blocked) => callFunction('admin', { action: 'block-user', id, blocked }),

  getContentStats: async () => {
    const meta = await loadMeta();
    const perLang = {};
    for (const lang of LANG_KEYS) {
      const file = await loadLangFile(lang);
      let lessons = 0, courseVocab = 0, words = 0, phrases = 0, dialogs = 0, exercises = 0, grammar = 0;
      file.modules.forEach((mod) =>
        mod.months.forEach((m) => {
          lessons += 1;
          courseVocab += (m.vocab || []).length;
          words += (m.words || []).length;
          phrases += (m.phrases || []).length;
          if (m.dialog) dialogs += 1;
          if (m.dialog2) dialogs += 1;
          if (m.grammar) grammar += 1;
          exercises += (m.exercises || []).length;
        })
      );
      perLang[lang] = {
        title: meta.LANGS?.[lang]?.title || lang,
        flag: meta.LANGS?.[lang]?.flag,
        modules: file.modules.length,
        lessons,
        courseVocab,
        words,
        wordbank: (file.wordbank || []).reduce((s, c) => s + c.rows.length, 0),
        phrasebank: (file.phrasebank || []).reduce((s, c) => s + c.rows.length, 0),
        phrases,
        extraVocab: (file.dictExtra || []).reduce((s, c) => s + c.words.length, 0),
        dialogs: dialogs + (file.dialogsExtra || []).length,
        grammar,
        exercises,
        verbs: (file.verbTable || []).length,
      };
    }
    return perLang;
  },

  // ---------------- AI ----------------
  aiStatus: () => callFunction('ai', { action: 'status' }),
  aiTask: (payload) => callFunction('ai', { action: 'task', ...payload }),
  aiCheck: (payload) => callFunction('ai', { action: 'check', ...payload }),
  aiChat: (payload) => callFunction('ai', { action: 'chat', ...payload }),
  aiExplain: (payload) => callFunction('ai', { action: 'explain', ...payload }),
  aiTestKey: (id) => callFunction('ai', { action: 'test-key', id }),
  getAiSettings: () => callFunction('admin', { action: 'get-ai-settings' }),
  saveAiSettings: (payload) => callFunction('admin', { action: 'save-ai-settings', ...payload }),
  listApiKeys: () => callFunction('admin', { action: 'list-api-keys' }),
  addApiKey: (payload) => callFunction('admin', { action: 'add-api-key', ...payload }),
  updateApiKey: (payload) => callFunction('admin', { action: 'update-api-key', ...payload }),
  toggleApiKey: (id, isActive) => callFunction('admin', { action: 'toggle-api-key', id, isActive }),
  deleteApiKey: (id) => callFunction('admin', { action: 'delete-api-key', id }),
};
