import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { contentRouter } from "./routes/content.js";
import { progressRouter } from "./routes/progress.js";
import { booksRouter } from "./routes/books.js";
import { vocabSetsRouter } from "./routes/vocabSets.js";
import { adminRouter } from "./routes/admin.js";
import { aiRouter } from "./routes/ai.js";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "til-sayohati-backend" }));

app.use("/api/auth", authRouter);
app.use("/api/content", contentRouter);
app.use("/api/progress", progressRouter);
app.use("/api/books", booksRouter);
app.use("/api/vocab-sets", vocabSetsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ai", aiRouter);

app.use((req, res) => res.status(404).json({ error: "Topilmadi" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server xatosi" });
});

app.listen(PORT, () => {
  console.log(`✅ Backend http://localhost:${PORT} manzilida ishga tushdi`);
});
