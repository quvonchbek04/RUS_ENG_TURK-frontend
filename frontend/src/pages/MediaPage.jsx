import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import MediaUploader from '../components/MediaUploader.jsx';
import MediaViewer from '../components/MediaViewer.jsx';
import { AiText, EmptyState, LangChips, LANG_BY_KEY, Modal, PageHeader, formatBytes, formatDate } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { MEDIA_META } from '../lib/media.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdminRole } from '../lib/lessonProgress.js';

function LangBadge({ lang }) {
  if (lang === 'all') return <span className="badge">🌐 Barcha</span>;
  const l = LANG_BY_KEY[lang];
  return <span className="badge">{l?.flag} {l?.short}</span>;
}

function AdminTools({ item, index, total, onMove, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      {!item.isPublished && <span className="badge badge-gold mr-1">Yashirin</span>}
      <button type="button" className="btn btn-ghost btn-icon !w-8 !h-8 !min-h-8 text-xs" disabled={index === 0} onClick={() => onMove(index, -1)} title="Yuqoriga">
        ↑
      </button>
      <button type="button" className="btn btn-ghost btn-icon !w-8 !h-8 !min-h-8 text-xs" disabled={index === total - 1} onClick={() => onMove(index, 1)} title="Pastga">
        ↓
      </button>
      <button type="button" className="btn btn-ghost btn-icon !w-8 !h-8 !min-h-8 text-xs" onClick={() => onEdit(item)} title="Tahrirlash">
        ✏️
      </button>
      <button type="button" className="btn btn-danger btn-icon !w-8 !h-8 !min-h-8 text-xs" onClick={() => onDelete(item)} title="O'chirish">
        🗑
      </button>
    </div>
  );
}

export default function MediaPage() {
  const { kind } = useParams();
  const meta = MEDIA_META[kind];
  const { user, progress, updateProgress } = useAuth();
  const isStaff = isAdminRole(user?.role);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [current, setCurrent] = useState(0); // audio/video pleylist
  const [continuous, setContinuous] = useState(true);
  const [openIdx, setOpenIdx] = useState(null); // modal (matn, dialog, lug'at, rasm)
  const [editing, setEditing] = useState(null);
  const playerRef = useRef(null);

  const load = useCallback(() => {
    setError('');
    api
      .listMedia({ kind })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [kind]);

  useEffect(() => {
    setItems(null);
    setCurrent(0);
    setOpenIdx(null);
    setShowUpload(false);
    load();
  }, [load]);

  const list = useMemo(() => (items || []).filter((i) => lang === 'all' || i.lang === lang || i.lang === 'all'), [items, lang]);
  const doneMap = progress.mediaDone || {};

  if (!meta) return <Navigate to="/" replace />;

  function markDone(item, value = true) {
    updateProgress((prev) => ({ ...prev, mediaDone: { ...(prev.mediaDone || {}), [item.id]: value } }));
  }

  async function move(index, dir) {
    const arr = [...list];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    if (lang === 'all') setItems(arr);
    try {
      await api.reorderMedia(arr);
      load();
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  async function remove(item) {
    if (!confirm(`"${item.title}" o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    try {
      await api.deleteMedia(item);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      const updated = await api.updateMedia(editing.id, {
        title: editing.title,
        description: editing.description,
        lang: editing.lang,
        isPublished: editing.isPublished,
        content: editing.kind === 'news' || editing.kind === 'text' ? { ...editing.content, text: editing.text } : undefined,
      });
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  }

  const adminProps = { total: list.length, onMove: move, onEdit: (it) => setEditing({ ...it, text: it.content?.text || '' }), onDelete: remove };
  const isPlaylist = kind === 'audio' || kind === 'video';
  const nowPlaying = isPlaylist ? list[current] : null;
  const opened = openIdx != null ? list[openIdx] : null;

  return (
    <Layout>
      <div className="page">
        <PageHeader
          eyebrow="Materiallar"
          title={`${meta.icon} ${meta.label}`}
          subtitle={
            {
              audio: "Qo'shiqlar va audio darslar ketma-ket ijro etiladi — tinglang va matni bilan birga kuzating.",
              video: 'Video darslar ketma-ketlikda — biri tugagach keyingisi boshlanadi.',
              image: "Rasmli lug'atlar va o'quv kartalari.",
              text: "Matnlarni o'qing va ovoz bilan tinglang, AI ustozdan vazifa oling.",
              dialog: 'Yuklangan dialoglar: tinglang, takrorlang, AI bilan mashq qiling.',
              vocab: "Yuklangan lug'at to'plamlari — har birini alohida mashq qilish mumkin.",
              news: "Platformadagi yangiliklar va e'lonlar.",
            }[kind]
          }
          actions={
            isStaff && (
              <button type="button" className={`btn ${showUpload ? 'btn-ghost' : 'btn-gold'}`} onClick={() => setShowUpload((v) => !v)}>
                {showUpload ? 'Yopish' : `+ ${kind === 'news' ? 'Yangilik' : 'Yuklash'}`}
              </button>
            )
          }
        />

        {isStaff && showUpload && (
          <MediaUploader
            kind={kind}
            defaultLang={lang}
            onCreated={(created) => setItems((prev) => [...(prev || []), ...created])}
            onCancel={() => setShowUpload(false)}
          />
        )}

        {kind !== 'news' && (
          <div className="mb-5">
            <LangChips value={lang} onChange={setLang} withAll />
          </div>
        )}

        {error && <div className="alert alert-error mb-4">{error}</div>}
        {!items && !error && (
          <div className="space-y-3">
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
        )}

        {items && list.length === 0 && (
          <EmptyState
            icon={meta.icon}
            title="Hozircha bo'sh"
            text={isStaff ? `"${meta.label}" bo'limiga birinchi materialni yuklang.` : 'Administratorlar tez orada materiallar qo\'shadi.'}
            action={isStaff && !showUpload && <button type="button" className="btn btn-gold" onClick={() => setShowUpload(true)}>+ Yuklash</button>}
          />
        )}

        {/* ---------- AUDIO / VIDEO: pleylist ---------- */}
        {isPlaylist && list.length > 0 && (
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5">
            <div ref={playerRef}>
              {nowPlaying && (
                <div className="card p-4 sm:p-5 lg:sticky lg:top-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-pine">
                      {current + 1}/{list.length}
                    </span>
                    <LangBadge lang={nowPlaying.lang} />
                  </div>
                  <div className="h2 mb-3">{nowPlaying.title}</div>
                  <MediaViewer
                    item={nowPlaying}
                    autoPlay={current > 0}
                    onEnded={() => {
                      markDone(nowPlaying);
                      if (continuous && current + 1 < list.length) setCurrent((c) => c + 1);
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <button type="button" className="btn btn-ghost" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
                      ⏮ Oldingi
                    </button>
                    <button type="button" className="btn btn-ghost" disabled={current + 1 >= list.length} onClick={() => setCurrent((c) => c + 1)}>
                      Keyingi ⏭
                    </button>
                    <label className="flex items-center gap-2 text-sm muted cursor-pointer ml-auto">
                      <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
                      Ketma-ket ijro
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {list.map((it, i) => (
                <div
                  key={it.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setCurrent(i);
                    if (window.innerWidth < 1024) playerRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="card p-3 flex items-center gap-3 cursor-pointer"
                  style={i === current ? { borderColor: 'var(--pine)', boxShadow: '0 0 0 3px var(--pine-soft)' } : undefined}
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: i === current ? 'var(--pine)' : 'var(--paper-soft)', color: i === current ? '#fff' : 'var(--ink-soft)' }}>
                    {i === current ? '▶' : doneMap[it.id] ? '✓' : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>
                      {it.title}
                    </div>
                    <div className="text-xs muted truncate">
                      {it.description || formatBytes(it.sizeBytes)} · {LANG_BY_KEY[it.lang]?.flag || '🌐'}
                    </div>
                  </div>
                  {isStaff && <AdminTools item={it} index={i} {...adminProps} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- RASMLAR: galereya ---------- */}
        {kind === 'image' && list.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {list.map((it, i) => (
              <div key={it.id} className="card overflow-hidden">
                <button type="button" className="block w-full aspect-square overflow-hidden" onClick={() => setOpenIdx(i)}>
                  <img src={it.fileUrl} alt={it.title} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-105" />
                </button>
                <div className="p-2.5">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
                    {it.title}
                  </div>
                  {isStaff && (
                    <div className="mt-1.5">
                      <AdminTools item={it} index={i} {...adminProps} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- YANGILIKLAR ---------- */}
        {kind === 'news' && list.length > 0 && (
          <div className="space-y-4 max-w-3xl">
            {[...list].reverse().map((it) => {
              const i = list.indexOf(it);
              return (
                <article key={it.id} className="card overflow-hidden">
                  {it.fileUrl && <img src={it.fileUrl} alt="" className="w-full max-h-80 object-cover" loading="lazy" />}
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs faint">{formatDate(it.createdAt)}</div>
                        <h2 className="h2">{it.title}</h2>
                      </div>
                      {isStaff && <AdminTools item={it} index={i} {...adminProps} />}
                    </div>
                    <div className="text-[15px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                      <AiText text={it.content?.text || ''} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ---------- MATN / DIALOG / LUG'AT: ketma-ket ro'yxat ---------- */}
        {['text', 'dialog', 'vocab'].includes(kind) && list.length > 0 && (
          <div className="space-y-2.5">
            {list.map((it, i) => (
              <div key={it.id} role="button" tabIndex={0} onClick={() => setOpenIdx(i)} className="card card-hover p-4 flex items-center gap-3 cursor-pointer">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: doneMap[it.id] ? 'var(--pine)' : 'var(--gold-soft)', color: doneMap[it.id] ? '#fff' : 'var(--gold)' }}
                >
                  {doneMap[it.id] ? '✓' : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {it.title}
                  </div>
                  <div className="text-xs muted flex flex-wrap gap-x-2">
                    <span>{LANG_BY_KEY[it.lang]?.flag || '🌐'}</span>
                    {kind === 'vocab' && <span>{(it.content?.words || []).length} ta so'z</span>}
                    {kind === 'dialog' && <span>{(it.content?.lines || []).length} qator{it.fileUrl ? ' · 🎧 audio' : ''}</span>}
                    {kind === 'text' && <span>{Math.ceil(String(it.content?.text || '').split(/\s+/).length / 180)} daqiqalik o'qish</span>}
                    {it.description && <span className="truncate">· {it.description}</span>}
                  </div>
                </div>
                {isStaff ? <AdminTools item={it} index={i} {...adminProps} /> : <span className="muted">›</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ko'rish oynasi — ketma-ket o'tish tugmalari bilan */}
      <Modal
        open={!!opened}
        onClose={() => setOpenIdx(null)}
        title={opened ? `${openIdx + 1}. ${opened.title}` : ''}
        wide
        footer={
          opened && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ghost" disabled={openIdx === 0} onClick={() => setOpenIdx((i) => i - 1)}>
                ← Oldingi
              </button>
              {kind !== 'image' && (
                <button type="button" className={`btn ${doneMap[opened.id] ? 'btn-soft' : 'btn-ghost'}`} onClick={() => markDone(opened, !doneMap[opened.id])}>
                  {doneMap[opened.id] ? "✓ O'rganildi" : "O'rganildi deb belgilash"}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary ml-auto"
                disabled={openIdx + 1 >= list.length}
                onClick={() => {
                  if (kind !== 'image') markDone(opened);
                  setOpenIdx((i) => i + 1);
                }}
              >
                Keyingisi →
              </button>
            </div>
          )
        }
      >
        {opened && <MediaViewer item={opened} />}
      </Modal>

      {/* Tahrirlash (admin) */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Tahrirlash">
        {editing && (
          <form onSubmit={saveEdit} className="space-y-3">
            <label className="field">
              <span className="label">Sarlavha</span>
              <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
            </label>
            {editing.kind !== 'news' && (
              <label className="field">
                <span className="label">Tavsif</span>
                <input className="input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </label>
            )}
            <label className="field">
              <span className="label">Til</span>
              <select className="select" value={editing.lang} onChange={(e) => setEditing({ ...editing, lang: e.target.value })}>
                <option value="all">🌐 Barcha tillar</option>
                <option value="en">🇬🇧 Ingliz tili</option>
                <option value="ru">🇷🇺 Rus tili</option>
                <option value="tr">🇹🇷 Turk tili</option>
              </select>
            </label>
            {(editing.kind === 'news' || editing.kind === 'text') && (
              <label className="field">
                <span className="label">Matn</span>
                <textarea className="textarea" rows={8} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} style={{ accentColor: 'var(--pine)' }} />
              O'quvchilarga ko'rinsin
            </label>
            <button type="submit" className="btn btn-primary">
              Saqlash
            </button>
          </form>
        )}
      </Modal>
    </Layout>
  );
}
