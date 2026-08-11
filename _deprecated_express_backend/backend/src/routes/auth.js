import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, ensureProgressRow } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, role: u.role };
}

authRouter.post("/register", (req, res) => {
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
    .prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, 'user')")
    .run(clean, hash, displayName || clean);
  ensureProgressRow(info.lastInsertRowid);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Login va parolni kiriting" });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  }
  ensureProgressRow(user.id);
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  res.json({ user: publicUser(user) });
});
