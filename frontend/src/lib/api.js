import { supabase } from './supabase.js';

// ============================================================================
// Bu fayl avvalgi Express-backend'dagi `api` obyektining ANIQ SHAKLINI saqlab
// qoladi — shu sababli boshqa hech qanday sahifa/komponentni o'zgartirish
// shart emas. Ichki amalga oshirilishi endi to'g'ridan-to'g'ri Supabase'ga
// (Postgres + Auth + Edge Functions) murojaat qiladi.
// ============================================================================

let cachedContent = null; // frontend/public/content.json — bir marta yuklanadi

async function loadStaticContent() {
  if (cachedContent) return cachedContent;
  const res = await fetch('/content.json');
  if (!res.ok) throw new Error("Kurs kontenti (content.json) topilmadi.");
  cachedContent = await res.json();
  return cachedContent;
}

function publicProfile(p) {
  return { id: p.id, username: p.username, displayName: p.display_name, role: p.role, createdAt: p.created_at };
}

function publicBook(b) {
  return {
    id: b.id,
    title: b.title,
    lang: b.lang,
    ext: b.ext,
    contentText: b.content_text,
    uploadedBy: b.uploaded_by,
    createdAt: b.created_at,
  };
}

function publicVocabSet(v) {
  return {
    id: v.id,
    title: v.title,
    lang: v.lang,
    ext: v.ext,
    words: v.words,
    uploadedBy: v.uploaded_by,
    createdAt: v.created_at,
  };
}

function throwIfError(error) {
  if (error) throw new Error(error.message || "Supabase so'rovida xatolik yuz berdi");
}

/** Superadmin/admin huquqi kerak bo'lgan amallar uchun Edge Function chaqiruvi.
 *
 * MUHIM TUZATISH: avval bu yerda `error.context?.error` orqali aniq xato matnini
 * olishga urinilar edi — lekin `error.context` aslida XOM Response obyekti
 * (supabase-js shunday qaytaradi), unda to'g'ridan-to'g'ri `.error` maydoni
 * bo'lmaydi. Shu sabab bu tekshiruv HAR DOIM `undefined` qaytarar va foydalanuvchi
 * doim umumiy "Edge Function returned a non-2xx status code" xabarini ko'rar edi —
 * asl sabab (masalan "Bu login band", "Ruxsat yo'q", yoki bazadagi aniq xato)
 * butunlay yashirinib qolardi. Endi Response tanasini to'g'ri o'qib, undagi haqiqiy
 * xato matnini chiqaramiz. */
async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let serverMessage = null;
    if (error.context && typeof error.context.json === 'function') {
      try {
        // Response klonlanadi, chunki ba'zi muhitlarda tanani faqat bir marta o'qish mumkin
        const parsed = await error.context.clone().json();
        serverMessage = parsed && parsed.error ? String(parsed.error) : null;
      } catch (_) {
        try { serverMessage = await error.context.clone().text(); } catch (_) { /* e'tiborsiz qoldiriladi */ }
      }
    }
    throw new Error(serverMessage || error.message || "Server bilan bog'lanishda xato yuz berdi");
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const api = {
  // ---------- AUTH ----------
  register: async ({ username, password, displayName }) => {
    const clean = String(username || '').trim();
    if (clean.length < 3 || String(password || '').length < 4) {
      throw new Error("Foydalanuvchi nomi kamida 3, parol kamida 4 belgidan iborat bo'lishi kerak");
    }
    const email = `${clean.toLowerCase()}@til-sayohati.app`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: clean, display_name: displayName || clean } },
    });
    if (error) {
      const msg = /already|registered|exists/i.test(error.message) ? "Bu foydalanuvchi nomi band" : error.message;
      throw new Error(msg);
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    return { user: publicProfile(profile) };
  },

  login: async ({ username, password }) => {
    const email = `${String(username || '').trim().toLowerCase()}@til-sayohati.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Login yoki parol noto'g'ri");
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    return { user: publicProfile(profile) };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  me: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kirish talab qilinadi');
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    throwIfError(error);
    return { user: publicProfile(profile) };
  },

  // ---------- KURS KONTENTI (statik fayl, backend shart emas) ----------
  langs: async () => {
    const raw = await loadStaticContent();
    return { langs: raw.LANGS, tabs: raw.TABS };
  },

  content: async (lang) => {
    const raw = await loadStaticContent();
    const LANG_DATA = { ru: raw.DATA_RU, en: raw.DATA_EN, tr: raw.DATA_TR };
    const DICT_EXTRA = { ru: raw.DICT_EXTRA_RU, en: raw.DICT_EXTRA_EN, tr: raw.DICT_EXTRA_TR };
    const VERB_TABLE = { ru: raw.VERB_TABLE_RU, en: raw.IRREGULAR_VERBS_EN, tr: raw.VERB_TABLE_TR };
    const DIALOGS_EXTRA = { ru: raw.DIALOGS_EXTRA_RU, en: raw.DIALOGS_EXTRA_EN, tr: raw.DIALOGS_EXTRA_TR };

    if (!LANG_DATA[lang]) throw new Error('Til topilmadi');

    const { data: uploadedSets } = await supabase
      .from('vocab_sets')
      .select('title, words')
      .eq('lang', lang)
      .order('id', { ascending: false });
    const uploadedCategories = (uploadedSets || []).map((row) => ({
      cat: `📤 ${row.title}`,
      level: 'custom',
      words: row.words || [],
    }));

    return {
      meta: raw.LANGS[lang],
      modules: LANG_DATA[lang],
      dictExtra: [...(DICT_EXTRA[lang] || []), ...uploadedCategories],
      verbTable: VERB_TABLE[lang] || [],
      dialogsExtra: DIALOGS_EXTRA[lang] || [],
    };
  },

  // ---------- PROGRESS ----------
  getProgress: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kirish talab qilinadi');
    const { data, error } = await supabase.from('progress').select('state, updated_at').eq('user_id', user.id).single();
    throwIfError(error);
    return { state: data?.state || {}, updatedAt: data?.updated_at };
  },

  putProgress: async (state) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kirish talab qilinadi');
    const { error } = await supabase
      .from('progress')
      .upsert({ user_id: user.id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    throwIfError(error);
    return { ok: true };
  },

  // ---------- KUTUBXONA ----------
  listBooks: async () => {
    const { data, error } = await supabase.from('books').select('*').order('id', { ascending: false });
    throwIfError(error);
    return { books: (data || []).map(publicBook) };
  },

  createBook: async ({ title, lang, ext, contentText }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kirish talab qilinadi');
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    const { data, error } = await supabase
      .from('books')
      .insert({
        user_id: user.id,
        title: String(title).slice(0, 300),
        lang,
        ext: ext || 'txt',
        content_text: String(contentText).slice(0, 1_500_000),
        uploaded_by: profile?.username,
      })
      .select('*')
      .single();
    throwIfError(error);
    return { book: publicBook(data) };
  },

  deleteBook: async (id) => {
    const { error } = await supabase.from('books').delete().eq('id', id);
    throwIfError(error);
    return { ok: true };
  },

  // ---------- LUG'AT TO'PLAMLARI ----------
  listVocabSets: async () => {
    const { data, error } = await supabase.from('vocab_sets').select('*').order('id', { ascending: false });
    throwIfError(error);
    return { vocabSets: (data || []).map(publicVocabSet) };
  },

  createVocabSet: async ({ title, lang, ext, words }) => {
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error("Sarlavha, til va kamida bitta so'z kerak");
    }
    const cleaned = words
      .filter((w) => Array.isArray(w) && w[0] && w[2])
      .slice(0, 5000)
      .map((w) => [String(w[0]).slice(0, 200), String(w[1] || '').slice(0, 200), String(w[2]).slice(0, 400)]);
    if (cleaned.length === 0) throw new Error("To'g'ri formatdagi so'z topilmadi");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kirish talab qilinadi');
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();

    const { data, error } = await supabase
      .from('vocab_sets')
      .insert({
        user_id: user.id,
        title: String(title).slice(0, 300),
        lang,
        ext: ext || 'txt',
        words: cleaned,
        uploaded_by: profile?.username,
      })
      .select('*')
      .single();
    throwIfError(error);
    return { vocabSet: publicVocabSet(data) };
  },

  deleteVocabSet: async (id) => {
    const { error } = await supabase.from('vocab_sets').delete().eq('id', id);
    throwIfError(error);
    return { ok: true };
  },

  // ---------- ADMIN ----------
  listAdminUsers: async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    throwIfError(error);
    return { users: (data || []).map(publicProfile) };
  },

  getAdminStats: async () => {
    const raw = await loadStaticContent();
    const LANGS = ['ru', 'en', 'tr'];
    const LANG_DATA = { ru: raw.DATA_RU, en: raw.DATA_EN, tr: raw.DATA_TR };
    const DICT_EXTRA = { ru: raw.DICT_EXTRA_RU, en: raw.DICT_EXTRA_EN, tr: raw.DICT_EXTRA_TR };
    const DIALOGS_EXTRA = { ru: raw.DIALOGS_EXTRA_RU, en: raw.DIALOGS_EXTRA_EN, tr: raw.DIALOGS_EXTRA_TR };
    const VERB_TABLE = { ru: raw.VERB_TABLE_RU, en: raw.IRREGULAR_VERBS_EN, tr: raw.VERB_TABLE_TR };

    const perLang = {};
    const totals = {
      stages: 0, lessons: 0, courseVocab: 0, extraVocab: 0, vocabTotal: 0,
      courseDialogs: 0, extraDialogs: 0, dialogsTotal: 0, grammarTopics: 0, exercises: 0, verbs: 0,
    };

    for (const lang of LANGS) {
      const stages = LANG_DATA[lang] || [];
      let lessons = 0, courseVocab = 0, courseDialogs = 0, grammarTopics = 0, exercises = 0;
      stages.forEach((s) => {
        lessons += s.months.length;
        s.months.forEach((m) => {
          courseVocab += (m.vocab || []).length;
          if (m.dialog) courseDialogs += 1;
          if (m.grammar) grammarTopics += 1;
          exercises += (m.exercises || []).length;
        });
      });
      const extraVocab = (DICT_EXTRA[lang] || []).reduce((s, c) => s + c.words.length, 0);
      const extraDialogs = (DIALOGS_EXTRA[lang] || []).length;
      const verbs = (VERB_TABLE[lang] || []).length;

      perLang[lang] = {
        title: raw.LANGS?.[lang]?.title || lang,
        stages: stages.length,
        lessons,
        courseVocab,
        extraVocab,
        vocabTotal: courseVocab + extraVocab,
        courseDialogs,
        extraDialogs,
        dialogsTotal: courseDialogs + extraDialogs,
        grammarTopics,
        exercises,
        verbs,
      };

      totals.stages += stages.length;
      totals.lessons += lessons;
      totals.courseVocab += courseVocab;
      totals.extraVocab += extraVocab;
      totals.vocabTotal += courseVocab + extraVocab;
      totals.courseDialogs += courseDialogs;
      totals.extraDialogs += extraDialogs;
      totals.dialogsTotal += courseDialogs + extraDialogs;
      totals.grammarTopics += grammarTopics;
      totals.exercises += exercises;
      totals.verbs += verbs;
    }

    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: bookCount } = await supabase.from('books').select('*', { count: 'exact', head: true });

    return { perLang, totals, userCount: userCount || 0, bookCount: bookCount || 0 };
  },

  createAdmin: (payload) => callFunction('admin', { action: 'create-admin', ...payload }),
  deleteAdmin: (id) => callFunction('admin', { action: 'delete-admin', id }),

  // ---------- AI ----------
  aiStatus: () => callFunction('ai', { action: 'status' }),
  aiTask: (payload) => callFunction('ai', { action: 'task', ...payload }),
  aiCheck: (payload) => callFunction('ai', { action: 'check', ...payload }),
  getAiSettings: () => callFunction('admin', { action: 'get-ai-settings' }),
  saveAiSettings: (payload) => callFunction('admin', { action: 'save-ai-settings', ...payload }),
  listApiKeys: () => callFunction('admin', { action: 'list-api-keys' }),
  addApiKey: (payload) => callFunction('admin', { action: 'add-api-key', ...payload }),
  toggleApiKey: (id, isActive) => callFunction('admin', { action: 'toggle-api-key', id, isActive }),
  deleteApiKey: (id) => callFunction('admin', { action: 'delete-api-key', id }),
};
