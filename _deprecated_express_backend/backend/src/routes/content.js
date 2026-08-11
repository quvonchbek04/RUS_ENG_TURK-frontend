import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, "..", "..", "data", "content.json");
const RAW = JSON.parse(fs.readFileSync(CONTENT_PATH, "utf-8"));

const LANG_DATA = { ru: RAW.DATA_RU, en: RAW.DATA_EN, tr: RAW.DATA_TR };
const DICT_EXTRA = { ru: RAW.DICT_EXTRA_RU, en: RAW.DICT_EXTRA_EN, tr: RAW.DICT_EXTRA_TR };
const VERB_TABLE = { ru: RAW.VERB_TABLE_RU, en: RAW.IRREGULAR_VERBS_EN, tr: RAW.VERB_TABLE_TR };

const DIALOGS_EXTRA = { ru: RAW.DIALOGS_EXTRA_RU, en: RAW.DIALOGS_EXTRA_EN, tr: RAW.DIALOGS_EXTRA_TR };

export const contentRouter = Router();

contentRouter.get("/langs", (req, res) => {
  res.json({ langs: RAW.LANGS, tabs: RAW.TABS });
});

contentRouter.get("/:lang", (req, res) => {
  const lang = req.params.lang;
  if (!LANG_DATA[lang]) return res.status(404).json({ error: "Til topilmadi" });

  // Foydalanuvchilar yuklagan lug'at to'plamlari — har biri alohida kategoriya
  // sifatida to'liq lug'atga va lug'at mashqi to'plamiga avtomatik qo'shiladi.
  const uploadedSets = db
    .prepare("SELECT title, words_json FROM vocab_sets WHERE lang = ? ORDER BY id DESC")
    .all(lang);
  const uploadedCategories = uploadedSets.map((row) => ({
    cat: `📤 ${row.title}`,
    level: "custom",
    words: JSON.parse(row.words_json || "[]"),
  }));

  res.json({
    meta: RAW.LANGS[lang],
    modules: LANG_DATA[lang],
    dictExtra: [...(DICT_EXTRA[lang] || []), ...uploadedCategories],
    verbTable: VERB_TABLE[lang] || [],
    dialogsExtra: DIALOGS_EXTRA[lang] || [],
  });
});
