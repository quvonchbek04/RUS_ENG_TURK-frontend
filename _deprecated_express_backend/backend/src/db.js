import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "app.db");

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lang TEXT NOT NULL,
    ext TEXT NOT NULL,
    content_text TEXT NOT NULL,
    finished INTEGER NOT NULL DEFAULT 0,
    uploaded_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vocab_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lang TEXT NOT NULL,
    ext TEXT NOT NULL,
    words_json TEXT NOT NULL,
    uploaded_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);

// Eski (uploaded_by ustunisiz) bazalar uchun xavfsiz migratsiya.
try {
  db.exec("ALTER TABLE books ADD COLUMN uploaded_by TEXT");
} catch {
  /* ustun allaqachon mavjud — e'tiborsiz qoldiramiz */
}

export function getSetting(key, fallback = "") {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value ?? "");
}

export function ensureProgressRow(userId) {
  const existing = db.prepare("SELECT user_id FROM progress WHERE user_id = ?").get(userId);
  if (!existing) {
    db.prepare("INSERT INTO progress (user_id, state_json) VALUES (?, ?)").run(userId, "{}");
  }
}

// Standart super admin hisobini urug'lash (agar hali mavjud bo'lmasa).
// Login: Quvonchbek / Parol: admin123 — birinchi ishga tushirishda avtomatik yaratiladi.
function seedSuperAdmin() {
  const SUPERADMIN_USERNAME = "Quvonchbek";
  const SUPERADMIN_PASSWORD = "admin123";
  const existing = db.prepare("SELECT id, role FROM users WHERE username = ?").get(SUPERADMIN_USERNAME);
  if (existing) {
    if (existing.role !== "superadmin") {
      db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(existing.id);
    }
    return;
  }
  const hash = bcrypt.hashSync(SUPERADMIN_PASSWORD, 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, 'superadmin')"
    )
    .run(SUPERADMIN_USERNAME, hash, SUPERADMIN_USERNAME);
  ensureProgressRow(info.lastInsertRowid);
  console.log(`👑 Super admin hisobi tayyor: ${SUPERADMIN_USERNAME} / ${SUPERADMIN_PASSWORD}`);
}

seedSuperAdmin();
