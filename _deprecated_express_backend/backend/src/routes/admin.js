import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { aiStatus, saveAiSettings } from "../ai/provider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, "..", "..", "data", "content.json");

export const adminRouter = Router();
adminRouter.use(requireAuth);

function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, role: u.role, createdAt: u.created_at };
}

// Sayt bo'yicha kontent statistikasi — har til uchun necha dars, so'z, dialog, grammatika
// mavzusi va fe'l borligini hisoblab beradi (admin panelda ko'rsatish uchun).
adminRouter.get("/stats", requireRole("superadmin", "admin"), (req, res) => {
  const RAW = JSON.parse(fs.readFileSync(CONTENT_PATH, "utf-8"));
  const LANGS = ["ru", "en", "tr"];
  const LANG_DATA = { ru: RAW.DATA_RU, en: RAW.DATA_EN, tr: RAW.DATA_TR };
  const DICT_EXTRA = { ru: RAW.DICT_EXTRA_RU, en: RAW.DICT_EXTRA_EN, tr: RAW.DICT_EXTRA_TR };
  const DIALOGS_EXTRA = { ru: RAW.DIALOGS_EXTRA_RU, en: RAW.DIALOGS_EXTRA_EN, tr: RAW.DIALOGS_EXTRA_TR };
  const VERB_TABLE = { ru: RAW.VERB_TABLE_RU, en: RAW.IRREGULAR_VERBS_EN, tr: RAW.VERB_TABLE_TR };

  const perLang = {};
  const totals = { stages: 0, lessons: 0, courseVocab: 0, extraVocab: 0, vocabTotal: 0, courseDialogs: 0, extraDialogs: 0, dialogsTotal: 0, grammarTopics: 0, exercises: 0, verbs: 0 };

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
      title: RAW.LANGS?.[lang]?.title || lang,
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

  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const bookCount = db.prepare("SELECT COUNT(*) AS c FROM books").get().c;

  res.json({ perLang, totals, userCount, bookCount });
});

// Super admin va adminlar foydalanuvchilar ro'yxatini ko'ra oladi
adminRouter.get("/users", requireRole("superadmin", "admin"), (req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY id ASC").all();
  res.json({ users: rows.map(publicUser) });
});

// Faqat super admin yangi admin qo'sha oladi
adminRouter.post("/admins", requireRole("superadmin"), (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password || username.trim().length < 3 || password.length < 4) {
    return res.status(400).json({
      error: "Foydalanuvchi nomi kamida 3, parol kamida 4 belgidan iborat bo'lishi kerak",
    });
  }
  const clean = username.trim();
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(clean);
  if (exists) return res.status(409).json({ error: "Bu foydalanuvchi nomi band" });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, 'admin')")
    .run(clean, hash, displayName || clean);
  db.prepare("INSERT INTO progress (user_id, state_json) VALUES (?, ?)").run(info.lastInsertRowid, "{}");

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.json({ user: publicUser(user) });
});

// Faqat super admin adminni o'chira oladi (super adminning o'zini o'chirib bo'lmaydi)
adminRouter.delete("/admins/:id", requireRole("superadmin"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  if (target.role === "superadmin") {
    return res.status(400).json({ error: "Super adminni o'chirib bo'lmaydi" });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
  res.json({ ok: true });
});

// AI (Gemini) sozlamalari — admin/superadmin holatni ko'ra oladi, faqat superadmin o'zgartira oladi
adminRouter.get("/ai-settings", requireRole("superadmin", "admin"), (req, res) => {
  res.json(aiStatus());
});

adminRouter.put("/ai-settings", requireRole("superadmin"), (req, res) => {
  const { geminiApiKey, provider } = req.body || {};
  if (provider && !["mock", "gemini"].includes(String(provider).toLowerCase())) {
    return res.status(400).json({ error: "Noto'g'ri provayder qiymati" });
  }
  saveAiSettings({ geminiApiKey, provider });
  res.json(aiStatus());
});
