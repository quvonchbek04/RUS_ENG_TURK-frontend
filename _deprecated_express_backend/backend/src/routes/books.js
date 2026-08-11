import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const booksRouter = Router();
booksRouter.use(requireAuth);

const MAX_TEXT_LENGTH = 1_500_000; // ~1.5M belgi, xavfsizlik chegarasi

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

// Kutubxona — barcha ro'yxatdan o'tgan foydalanuvchilar uchun UMUMIY (shared).
// Har kim ko'ra oladi, lekin faqat admin/superadmin yuklay va o'chira oladi.
booksRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM books ORDER BY id DESC").all();
  res.json({ books: rows.map(publicBook) });
});

booksRouter.post("/", requireRole("admin", "superadmin"), (req, res) => {
  const { title, lang, ext, contentText } = req.body || {};
  if (!title || !lang || !contentText) {
    return res.status(400).json({ error: "Sarlavha, til va matn kerak" });
  }
  const text = String(contentText).slice(0, MAX_TEXT_LENGTH);
  const info = db
    .prepare(
      "INSERT INTO books (user_id, title, lang, ext, content_text, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(req.user.id, String(title).slice(0, 300), lang, ext || "txt", text, req.user.username);
  const row = db.prepare("SELECT * FROM books WHERE id = ?").get(info.lastInsertRowid);
  res.json({ book: publicBook(row) });
});

booksRouter.delete("/:id", requireRole("admin", "superadmin"), (req, res) => {
  const info = db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Kitob topilmadi" });
  res.json({ ok: true });
});
