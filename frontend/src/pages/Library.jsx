import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import TtsReader from '../components/TtsReader.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import AiTaskWidget from '../components/AiTaskWidget.jsx';
import { api } from '../lib/api.js';
import { extractTextFromFile } from '../lib/extractText.js';
import { parseVocabText } from '../lib/parseVocab.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdminRole } from '../lib/lessonProgress.js';

const LANG_OPTIONS = [
  { key: 'ru', label: '🇷🇺 Rus tili' },
  { key: 'en', label: '🇬🇧 Ingliz tili' },
  { key: 'tr', label: '🇹🇷 Turk tili' },
];

const FORMAT_ICON = { pdf: '📕', docx: '📘', txt: '📄' };

export default function Library() {
  const { user, progress, updateProgress } = useAuth();
  const canManage = isAdminRole(user?.role);
  const [books, setBooks] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadLang, setUploadLang] = useState('ru');
  const [openBook, setOpenBook] = useState(null);
  const fileInputRef = useRef(null);

  const [vocabSets, setVocabSets] = useState(null);
  const [vocabError, setVocabError] = useState('');
  const [vocabUploading, setVocabUploading] = useState(false);
  const [vocabUploadLang, setVocabUploadLang] = useState('ru');
  const [openVocabSet, setOpenVocabSet] = useState(null);
  const vocabFileInputRef = useRef(null);

  function refreshVocabSets() {
    api.listVocabSets().then((r) => setVocabSets(r.vocabSets)).catch((e) => setVocabError(e.message));
  }

  useEffect(refreshVocabSets, []);

  async function onVocabFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVocabError('');
    setVocabUploading(true);
    try {
      const { text, ext } = await extractTextFromFile(file);
      if (!text) throw new Error("Fayldan matn topilmadi. Boshqa fayl tanlang.");
      const { items, skipped } = parseVocabText(text);
      if (items.length === 0) {
        throw new Error(
          "To'g'ri formatdagi so'z topilmadi. Har bir qator quyidagi formatlardan birida bo'lishi kerak: " +
          "\"so'z ; talaffuz ; tarjima\", \"so'z - tarjima\", \"so'z: tarjima\" yoki jadval ko'rinishida (Tab bilan ajratilgan)."
        );
      }
      const title = file.name.replace(/\.(pdf|docx|txt)$/i, '');
      const { vocabSet } = await api.createVocabSet({ title, lang: vocabUploadLang, ext, words: items });
      setVocabSets((prev) => [vocabSet, ...(prev || [])]);
      if (skipped > 0) {
        setVocabError(`Yuklandi: ${items.length} ta so'z. ${skipped} ta qator formatga mos kelmagani uchun o'tkazib yuborildi.`);
      }
    } catch (err) {
      setVocabError(err.message || "Faylni o'qishda xatolik yuz berdi");
    } finally {
      setVocabUploading(false);
    }
  }

  async function removeVocabSet(set) {
    if (!confirm(`"${set.title}" lug'at to'plami o'chirilsinmi? U lug'at mashqidan ham olib tashlanadi.`)) return;
    setVocabSets((prev) => prev.filter((v) => v.id !== set.id));
    if (openVocabSet?.id === set.id) setOpenVocabSet(null);
    try {
      await api.deleteVocabSet(set.id);
    } catch {
      refreshVocabSets();
    }
  }

  function refresh() {
    api.listBooks().then((r) => setBooks(r.books)).catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { text, ext } = await extractTextFromFile(file);
      if (!text) throw new Error("Fayldan matn topilmadi. Boshqa fayl tanlang.");
      const title = file.name.replace(/\.(pdf|docx|txt)$/i, '');
      const { book } = await api.createBook({ title, lang: uploadLang, ext, contentText: text });
      setBooks((prev) => [book, ...(prev || [])]);
    } catch (err) {
      setError(err.message || "Faylni o'qishda xatolik yuz berdi");
    } finally {
      setUploading(false);
    }
  }

  // "O'qildi" belgisi endi har bir foydalanuvchi uchun ALOHIDA — o'zining shaxsiy
  // progressida saqlanadi (kutubxona endi umumiy bo'lgani uchun, bitta ustunda
  // saqlash hammaga bir xil holatni ko'rsatib qo'yardi).
  function isFinished(bookId) {
    return !!progress.booksFinished?.[bookId];
  }
  function toggleFinished(book) {
    updateProgress((prev) => {
      const booksFinished = { ...(prev.booksFinished || {}) };
      booksFinished[book.id] = !booksFinished[book.id];
      return { ...prev, booksFinished };
    });
  }

  async function removeBook(book) {
    if (!confirm(`"${book.title}" kutubxonadan o'chirilsinmi?`)) return;
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    if (openBook?.id === book.id) setOpenBook(null);
    try {
      await api.deleteBook(book.id);
    } catch {
      refresh();
    }
  }

  function voiceSettingsFor(lang) {
    return progress.voiceSettings?.[lang] || { rate: 0.9, voiceURI: null };
  }

  function setVoiceSettings(lang, patch) {
    updateProgress((prev) => {
      const voiceSettings = { ...(prev.voiceSettings || {}) };
      voiceSettings[lang] = { ...voiceSettingsFor(lang), ...patch };
      return { ...prev, voiceSettings };
    });
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-5 py-10">
        <div className="mb-8">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Kutubxona
          </div>
          <h1 className="font-display text-4xl font-semibold" style={{ color: 'var(--ink)' }}>
            O'qing va tinglang
          </h1>
          <p className="mt-2" style={{ color: 'var(--ink-soft)' }}>
            {canManage
              ? "PDF, DOCX yoki oddiy matn faylini yuklang — barcha foydalanuvchilar uchun umumiy kutubxonaga qo'shiladi."
              : "Bu — barcha foydalanuvchilar uchun umumiy kutubxona. Administratorlar tomonidan qo'shilgan matnlarni o'qing va tinglang."}
          </p>
        </div>

        {canManage ? (
          <div
            className="ticket-edge rounded-2xl border p-6 mb-10 flex flex-wrap items-center gap-4"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <select
              value={uploadLang}
              onChange={(e) => setUploadLang(e.target.value)}
              className="font-mono text-xs px-3 py-2.5 rounded-lg border"
              style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold disabled:opacity-60"
              style={{ background: 'var(--gold)', color: 'var(--panel)' }}
            >
              {uploading ? 'Yuklanmoqda…' : '+ Fayl yuklash'}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={onFileChosen} />

            <span className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              .pdf · .docx · .txt · barchaga ko'rinadi
            </span>
          </div>
        ) : (
          <div
            className="rounded-2xl border p-4 mb-10 font-mono text-xs"
            style={{ borderColor: 'var(--line)', background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}
          >
            👁 Ko'rish rejimi — yangi matn qo'sha olmaysiz, faqat mavjudlarini o'qish/tinglash mumkin.
          </div>
        )}

        {error && (
          <div className="mb-6 text-sm px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
            {error}
          </div>
        )}

        {!books && <div className="font-mono text-sm" style={{ color: 'var(--ink-soft)' }}>Yuklanmoqda…</div>}

        {books && books.length === 0 && (
          <div className="font-mono text-sm text-center py-16" style={{ color: 'var(--ink-soft)' }}>
            {canManage ? 'Hali kutubxona bo\'sh. Birinchi faylni yuklang.' : 'Kutubxona hali bo\'sh.'}
          </div>
        )}

        <div className="grid gap-3">
          {books?.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border p-4 flex items-center gap-4"
              style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
            >
              <span className="text-2xl shrink-0">{FORMAT_ICON[b.ext] || '📄'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {b.title}
                </div>
                <div className="font-mono text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--ink-soft)' }}>
                  <span>{LANG_OPTIONS.find((l) => l.key === b.lang)?.label}</span>
                  <span>·</span>
                  <span>{b.ext.toUpperCase()}</span>
                  <span>·</span>
                  <span>{new Date(b.createdAt).toLocaleDateString('uz-UZ')}</span>
                  {b.uploadedBy && (
                    <>
                      <span>·</span>
                      <span>@{b.uploadedBy}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleFinished(b)}
                title="O'qib bo'lganini belgilash (shaxsiy)"
                className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-2 rounded-lg cursor-pointer border shrink-0"
                style={{
                  borderColor: isFinished(b.id) ? 'var(--pine)' : 'var(--line)',
                  background: isFinished(b.id) ? 'var(--pine)' : 'transparent',
                  color: isFinished(b.id) ? 'var(--paper)' : 'var(--ink-soft)',
                }}
              >
                {isFinished(b.id) ? "✓ O'qildi" : "O'qildi"}
              </button>
              <button
                onClick={() => setOpenBook(b)}
                className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg cursor-pointer shrink-0"
                style={{ background: 'var(--paper-soft)', color: 'var(--pine)' }}
              >
                📂 Ochish
              </button>
              {canManage && (
                <button
                  onClick={() => removeBook(b)}
                  title="O'chirish"
                  className="w-8 h-8 rounded-lg cursor-pointer shrink-0 flex items-center justify-center"
                  style={{ color: 'var(--brick)' }}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ============ LUG'AT QO'SHISH (fayldan) ============ */}
        <div className="mt-14 mb-8">
          <div className="font-mono text-xs tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
            Kutubxona
          </div>
          <h1 className="font-display text-4xl font-semibold" style={{ color: 'var(--ink)' }}>
            Lug'at qo'shish
          </h1>
          <p className="mt-2" style={{ color: 'var(--ink-soft)' }}>
            {canManage
              ? "PDF, DOCX yoki oddiy matn faylini yuklang — so'zlar avtomatik ravishda \"Lug'at mashqi\"ga va To'liq lug'atga qo'shiladi, har biriga ovoz bilan o'qish ham biriktiriladi."
              : "Administratorlar tomonidan qo'shilgan lug'at to'plamlari — bular allaqachon lug'at mashqiga qo'shilgan."}
          </p>
        </div>

        {canManage ? (
          <div
            className="ticket-edge rounded-2xl border p-6 mb-10 flex flex-wrap items-center gap-4"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
          >
            <select
              value={vocabUploadLang}
              onChange={(e) => setVocabUploadLang(e.target.value)}
              className="font-mono text-xs px-3 py-2.5 rounded-lg border"
              style={{ borderColor: 'var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => vocabFileInputRef.current?.click()}
              disabled={vocabUploading}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold disabled:opacity-60"
              style={{ background: 'var(--gold)', color: 'var(--panel)' }}
            >
              {vocabUploading ? 'Yuklanmoqda…' : '+ Lug\'at fayli yuklash'}
            </button>
            <input ref={vocabFileInputRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={onVocabFileChosen} />

            <span className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              .pdf · .docx · .txt · har qatorda: so'z — tarjima (yoki so'z; talaffuz; tarjima)
            </span>
          </div>
        ) : (
          <div
            className="rounded-2xl border p-4 mb-10 font-mono text-xs"
            style={{ borderColor: 'var(--line)', background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}
          >
            👁 Ko'rish rejimi — yangi lug'at qo'sha olmaysiz.
          </div>
        )}

        {vocabError && (
          <div className="mb-6 text-sm px-3 py-2 rounded-lg inline-block" style={{ background: 'var(--error-bg)', color: 'var(--brick)' }}>
            {vocabError}
          </div>
        )}

        {!vocabSets && <div className="font-mono text-sm" style={{ color: 'var(--ink-soft)' }}>Yuklanmoqda…</div>}

        {vocabSets && vocabSets.length === 0 && (
          <div className="font-mono text-sm text-center py-16" style={{ color: 'var(--ink-soft)' }}>
            {canManage ? "Hali lug'at to'plami yo'q. Birinchi faylni yuklang." : "Hali lug'at to'plami yo'q."}
          </div>
        )}

        <div className="grid gap-3">
          {vocabSets?.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border p-4 flex items-center gap-4"
              style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
            >
              <span className="text-2xl shrink-0">📖</span>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {v.title}
                </div>
                <div className="font-mono text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--ink-soft)' }}>
                  <span>{LANG_OPTIONS.find((l) => l.key === v.lang)?.label}</span>
                  <span>·</span>
                  <span>{v.words.length} ta so'z</span>
                  <span>·</span>
                  <span>{new Date(v.createdAt).toLocaleDateString('uz-UZ')}</span>
                  {v.uploadedBy && (
                    <>
                      <span>·</span>
                      <span>@{v.uploadedBy}</span>
                    </>
                  )}
                </div>
              </div>
              <Link
                to={`/lang/${v.lang}/practice-full`}
                className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg cursor-pointer shrink-0"
                style={{ background: 'var(--paper-soft)', color: 'var(--pine)' }}
              >
                🔀 Mashq qilish
              </Link>
              <button
                onClick={() => setOpenVocabSet(v)}
                className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg cursor-pointer shrink-0"
                style={{ background: 'var(--paper-soft)', color: 'var(--pine)' }}
              >
                📂 Ko'rish
              </button>
              {canManage && (
                <button
                  onClick={() => removeVocabSet(v)}
                  title="O'chirish"
                  className="w-8 h-8 rounded-lg cursor-pointer shrink-0 flex items-center justify-center"
                  style={{ color: 'var(--brick)' }}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {openVocabSet && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(20,20,19,0.6)' }}
          onClick={() => setOpenVocabSet(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 max-h-[85vh] scroll-panel"
            style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                {openVocabSet.title}
              </h2>
              <button
                onClick={() => setOpenVocabSet(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}
              >
                ✕
              </button>
            </div>
            <div className="grid gap-2.5">
              {openVocabSet.words.map(([word, translit, meaning], i) => (
                <div
                  key={i}
                  className="rounded-xl border p-3.5 flex items-start gap-3"
                  style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
                      {word}
                    </div>
                    <div className="font-mono text-xs mb-1" style={{ color: 'var(--gold)' }}>
                      {translit}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                      {meaning}
                    </div>
                  </div>
                  <SpeakButton text={word} lang={openVocabSet.lang} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {openBook && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(20,20,19,0.6)' }}
          onClick={() => setOpenBook(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 max-h-[85vh] scroll-panel"
            style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                {openBook.title}
              </h2>
              <button
                onClick={() => setOpenBook(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}
              >
                ✕
              </button>
            </div>
            <TtsReader
              text={openBook.contentText}
              lang={openBook.lang}
              rate={voiceSettingsFor(openBook.lang).rate ?? 0.9}
              voiceURI={voiceSettingsFor(openBook.lang).voiceURI}
              onRateChange={(rate) => setVoiceSettings(openBook.lang, { rate })}
              onVoiceChange={(voiceURI) => setVoiceSettings(openBook.lang, { voiceURI })}
            />
            <AiTaskWidget type="text" content={openBook.contentText} lang={openBook.lang} />
          </div>
        </div>
      )}
    </Layout>
  );
}
