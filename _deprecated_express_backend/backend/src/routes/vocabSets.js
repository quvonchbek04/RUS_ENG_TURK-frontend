import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const vocabSetsRouter = Router();
vocabSetsRouter.use(requireAuth);

const MAX_WORDS = 5000; // xavfsizlik chegarasi

function publicSet(row) {
  return {
    id: row.id,
    title: row.title,
    lang: row.lang,
    ext: row.ext,
    words: JSON.parse(row.words_json || "[]"),
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

// Lug'at to'plamlari — kutubxona kabi barcha foydalanuvchilar uchun UMUMIY (shared).
// Har kim ko'ra oladi va mashq qila oladi, lekin faqat admin/superadmin yuklay va o'chira oladi.
vocabSetsRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM vocab_sets ORDER BY id DESC").all();
  res.json({ vocabSets: rows.map(publicSet) });
});

vocabSetsRouter.post("/", requireRole("admin", "superadmin"), (req, res) => {
  const { title, lang, ext, words } = req.body || {};
  if (!title || !lang || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: "Sarlavha, til va kamida bitta so'z kerak" });
  }
  const cleaned = words
    .filter((w) => Array.isArray(w) && w[0] && w[2])
    .slice(0, MAX_WORDS)
    .map((w) => [String(w[0]).slice(0, 200), String(w[1] || "").slice(0, 200), String(w[2]).slice(0, 400)]);
  if (cleaned.length === 0) {
    return res.status(400).json({ error: "To'g'ri formatdagi so'z topilmadi" });
  }
  const info = db
    .prepare(
      "INSERT INTO vocab_sets (user_id, title, lang, ext, words_json, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(req.user.id, String(title).slice(0, 300), lang, ext || "txt", JSON.stringify(cleaned), req.user.username);
  const row = db.prepare("SELECT * FROM vocab_sets WHERE id = ?").get(info.lastInsertRowid);
  res.json({ vocabSet: publicSet(row) });
});

vocabSetsRouter.delete("/:id", requireRole("admin", "superadmin"), (req, res) => {
  const info = db.prepare("DELETE FROM vocab_sets WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Lug'at to'plami topilmadi" });
  res.json({ ok: true });
});
