import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { generateTask, checkAnswer, aiStatus } from "../ai/provider.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

// Frontend AI holatini (mock yoki gemini) ko'rsatishi uchun
aiRouter.get("/status", (req, res) => {
  res.json(aiStatus());
});

// Matn yoki dialog asosida vazifa (savol) generatsiya qilish
aiRouter.post("/task", async (req, res) => {
  const { type, content, lang } = req.body || {};
  if (!content || !lang) {
    return res.status(400).json({ error: "content va lang maydonlari kerak" });
  }
  try {
    const task = await generateTask({ type: type === "dialog" ? "dialog" : "text", content, lang });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Vazifa generatsiya qilishda xatolik yuz berdi" });
  }
});

// Foydalanuvchi javobini tekshirish / fikr-mulohaza olish
aiRouter.post("/check", async (req, res) => {
  const { context, question, answer, lang } = req.body || {};
  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: "Javob matni bo'sh bo'lmasligi kerak" });
  }
  try {
    const result = await checkAnswer({ context, question, answer, lang });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Javobni tekshirishda xatolik yuz berdi" });
  }
});
