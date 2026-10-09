import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { MEDIA_META } from '../lib/media.js';
import { parseVocabText } from '../lib/parseVocab.js';
import { parseDialogText } from '../lib/parseDialog.js';
import { flattenMonths } from '../lib/lessonProgress.js';
import { t } from '../i18n/index.js';
import { LANG_OPTIONS, formatBytes } from './ui.jsx';

const stripExt = (name) => String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' ').trim();

/** Admin uchun material yuklash formasi (har bir tur uchun mos maydonlar bilan). */
export default function MediaUploader({ kind, defaultLang = 'all', onCreated, onCancel }) {
  const meta = MEDIA_META[kind];
  const [lang, setLang] = useState(defaultLang);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [extraFile, setExtraFile] = useState(null); // dialog uchun audio, yangilik uchun rasm
  const [lessonRef, setLessonRef] = useState('');
  const [lessons, setLessons] = useState([]);
  const [isPublished, setIsPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);

  const isFileKind = ['audio', 'video', 'image'].includes(kind);
  const isParsedKind = ['text', 'dialog', 'vocab'].includes(kind);

  useEffect(() => {
    if (lang === 'all') {
      setLessons([]);
      setLessonRef('');
      return;
    }
    api
      .content(lang)
      .then((d) => setLessons(flattenMonths(d.modules)))
      .catch(() => setLessons([]));
  }, [lang]);

  const parsedPreview = useMemo(() => {
    if (kind === 'vocab' && text.trim()) return parseVocabText(text);
    if (kind === 'dialog' && text.trim()) return { items: parseDialogText(text), skipped: 0 };
    return null;
  }, [kind, text]);

  async function onPickParsedFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    setProgressMsg(t("Fayl o'qilmoqda…"));
    try {
      // PDF/DOCX o'quvchi kutubxonalar og'ir — faqat kerak bo'lganda yuklanadi
      const { extractTextFromFile } = await import('../lib/extractText.js');
      const { text: extracted } = await extractTextFromFile(file);
      if (!extracted) throw new Error(t('Fayldan matn topilmadi'));
      setText(extracted);
      if (!title) setTitle(stripExt(file.name));
    } catch (err) {
      setError(t(err.message) || t("Faylni o'qib bo'lmadi"));
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const created = [];
    let info = '';
    try {
      const common = { kind, lang, description: description.trim() || null, lessonRef: lessonRef || null, isPublished };
      if (isFileKind) {
        if (!files.length) throw new Error(t('Kamida bitta fayl tanlang'));
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setProgressMsg(t('{a}/{b}: "{name}" yuklanmoqda…', { a: i + 1, b: files.length, name: f.name }));
          const fileTitle = files.length === 1 && title.trim() ? title.trim() : stripExt(f.name);
          created.push(await api.createMedia({ ...common, title: fileTitle, file: f, content: text.trim() ? { text: text.trim() } : {} }));
        }
      } else if (kind === 'text') {
        if (!text.trim()) throw new Error(t('Matnni kiriting yoki fayl tanlang'));
        created.push(await api.createMedia({ ...common, title: title.trim() || t('Matn'), content: { text: text.trim() } }));
      } else if (kind === 'vocab') {
        const { items, skipped } = parseVocabText(text);
        if (!items.length) throw new Error(t("To'g'ri formatdagi so'z topilmadi. Har qatorda: so'z — tarjima"));
        created.push(await api.createMedia({ ...common, title: title.trim() || t("Lug'at"), content: { words: items.slice(0, 5000) } }));
        if (skipped) info = t("✅ {n} ta so'z qo'shildi, {s} ta qator formatga mos kelmadi.", { n: items.length, s: skipped });
      } else if (kind === 'dialog') {
        const lines = parseDialogText(text);
        if (lines.length < 2) throw new Error(t('Kamida 2 qatorli dialog kiriting (masalan: «A: Hello! | Salom!»)'));
        setProgressMsg(extraFile ? t('Audio yuklanmoqda…') : t('Saqlanmoqda…'));
        created.push(await api.createMedia({ ...common, title: title.trim() || t('Dialog'), content: { lines }, file: extraFile || undefined }));
      } else if (kind === 'news') {
        if (!title.trim() || !text.trim()) throw new Error(t('Sarlavha va yangilik matnini kiriting'));
        created.push(await api.createMedia({ ...common, title: title.trim(), content: { text: text.trim() }, file: extraFile || undefined }));
      }
      onCreated?.(created);
      setTitle('');
      setDescription('');
      setText('');
      setFiles([]);
      setExtraFile(null);
      setNotice(info || t("✅ {n} ta material qo'shildi", { n: created.length }));
    } catch (err) {
      if (created.length) onCreated?.(created);
      setError(t(err.message) || t('Yuklashda xatolik'));
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5 mb-6 anim-rise" style={{ borderColor: 'color-mix(in srgb, var(--gold) 40%, var(--line))' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{meta.icon}</span>
        <div className="font-bold flex-1" style={{ color: 'var(--ink)' }}>
          {t("Yangi qo'shish — {name}", { name: meta.label })}
        </div>
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {t('Yopish')}
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="field">
          <span className="label">{t('Til')}</span>
          <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="all">{t('🌐 Barcha tillar uchun')}</option>
            {LANG_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field !mt-0">
          <span className="label">
            {t('Sarlavha')} {isFileKind && files.length > 1 ? t('(fayl nomlari ishlatiladi)') : ''}
          </span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'news' ? t("Masalan: Yangi darslar qo'shildi!") : t('Nomi')}
            disabled={isFileKind && files.length > 1}
          />
        </label>
      </div>

      {kind !== 'news' && (
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label className="field !mt-0">
            <span className="label">{t('Qisqa tavsif (ixtiyoriy)')}</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Masalan: A1 daraja, tinglab takrorlang')} />
          </label>
          <label className="field !mt-0">
            <span className="label">{t('Darsga biriktirish (ixtiyoriy)')}</span>
            <select className="select" value={lessonRef} onChange={(e) => setLessonRef(e.target.value)} disabled={lang === 'all'}>
              <option value="">{lang === 'all' ? t('Avval tilni tanlang') : t('— Hech qaysi darsga emas —')}</option>
              {lessons.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.moduleTitle)} · {t(m.label)} · {t(m.topic)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Fayl (audio / video / rasm) */}
      {isFileKind && (
        <div className="mt-3">
          <span className="label">{t('Fayl(lar)')}</span>
          <div
            className="rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors"
            style={{ borderColor: 'var(--line-strong)', background: 'var(--panel-2)' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setFiles(Array.from(e.dataTransfer.files || []));
            }}
          >
            <div className="text-3xl mb-1">{meta.icon}</div>
            <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
              {t('Fayl tanlash yoki shu yerga tashlash')}
            </div>
            <div className="text-xs muted mt-1">{meta.hint}</div>
          </div>
          <input ref={fileRef} type="file" hidden accept={meta.accept} multiple={meta.multiple} onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="text-sm flex items-center gap-2 card-soft px-3 py-1.5">
                  <span className="flex-1 truncate">
                    {i + 1}. {f.name}
                  </span>
                  <span className="text-xs faint">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Matn / dialog / lug'at — fayldan yoki qo'lda */}
      {isParsedKind && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="label !mb-0 flex-1">{kind === 'text' ? t('Matn') : kind === 'dialog' ? t('Dialog qatorlari') : t("So'zlar ro'yxati")}</span>
            <label className="btn btn-ghost btn-sm cursor-pointer">
              {t('📎 Fayldan (PDF/DOCX/TXT)')}
              <input type="file" hidden accept={meta.accept} onChange={onPickParsedFile} />
            </label>
          </div>
          <textarea
            className="textarea font-mono text-sm"
            rows={kind === 'text' ? 10 : 8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === 'dialog'
                ? t("A: Hello! How are you? | Salom! Qalaysiz?\nB: I'm fine, thanks. | Yaxshiman, rahmat.")
                : kind === 'vocab'
                  ? t('apple — olma\nbook ; buk ; kitob\nhouse | uy')
                  : t('Matnni shu yerga yozing yoki fayl tanlang…')
            }
          />
          <div className="help">{meta.hint}</div>
          {parsedPreview && (
            <div className="help" style={{ color: parsedPreview.items.length ? 'var(--pine)' : 'var(--brick)' }}>
              {kind === 'vocab' ? t("Topildi: {n} ta so'z", { n: parsedPreview.items.length }) : t('Topildi: {n} ta qator', { n: parsedPreview.items.length })}
              {parsedPreview.skipped ? t(' · {n} ta qator mos kelmadi', { n: parsedPreview.skipped }) : ''}
            </div>
          )}
        </div>
      )}

      {(isFileKind || kind === 'news') && (
        <label className="field mt-3">
          <span className="label">{meta.textLabel}</span>
          <textarea className="textarea" rows={kind === 'news' ? 6 : 3} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}

      {(kind === 'dialog' || kind === 'news') && (
        <label className="field mt-3">
          <span className="label">{kind === 'dialog' ? t('Dialog audiosi (ixtiyoriy)') : t('Rasm (ixtiyoriy)')}</span>
          <input type="file" className="input !py-2" accept={kind === 'dialog' ? 'audio/*' : 'image/*'} onChange={(e) => setExtraFile(e.target.files?.[0] || null)} />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm mt-4 cursor-pointer select-none">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
        {t("Darhol barcha o'quvchilarga ko'rinsin")}
      </label>

      {error && <div className="alert alert-error mt-3">{error}</div>}
      {notice && !error && <div className="alert alert-success mt-3">{notice}</div>}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <><span className="spinner" /> {progressMsg || t('Saqlanmoqda…')}</> : t('⬆ Yuklash va saqlash')}
        </button>
      </div>
    </form>
  );
}
