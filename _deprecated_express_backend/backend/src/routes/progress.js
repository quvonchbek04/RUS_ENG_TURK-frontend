import { Router } from "express";
import { db, ensureProgressRow } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const progressRouter = Router();

progressRouter.get("/", requireAuth, (req, res) => {
  ensureProgressRow(req.user.id);
  const row = db.prepare("SELECT state_json, updated_at FROM progress WHERE user_id = ?").get(req.user.id);
  res.json({ state: JSON.parse(row.state_json || "{}"), updatedAt: row.updated_at });
});

progressRouter.put("/", requireAuth, (req, res) => {
  const { state } = req.body || {};
  if (typeof state !== "object" || state === null) {
    return res.status(400).json({ error: "Noto'g'ri holat formati" });
  }
  ensureProgressRow(req.user.id);
  db.prepare(
    "UPDATE progress SET state_json = ?, updated_at = datetime('now') WHERE user_id = ?"
  ).run(JSON.stringify(state), req.user.id);
  res.json({ ok: true });
});
