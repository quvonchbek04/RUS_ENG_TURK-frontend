import jwt from "jsonwebtoken";
import { db } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Kirish talab qilinadi" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Sessiya eskirgan, qayta kiring" });
  }
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

/** Faqat ko'rsatilgan rollardagi foydalanuvchilarga ruxsat beradi (requireAuth'dan keyin ishlatiladi).
 *  Rolni har doim bazadan (JWT'dagi eski ma'lumot emas) tekshiradi. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Kirish talab qilinadi" });
    const row = db.prepare("SELECT role FROM users WHERE id = ?").get(req.user.id);
    if (!row || !roles.includes(row.role)) {
      return res.status(403).json({ error: "Bu amal uchun ruxsatingiz yo'q" });
    }
    req.user.role = row.role;
    next();
  };
}
