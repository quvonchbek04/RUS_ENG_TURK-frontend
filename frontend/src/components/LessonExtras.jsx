import { useMemo, useState } from 'react';
import SpeakButton from './SpeakButton.jsx';

const card = { borderColor: 'var(--line)', background: 'var(--panel)' };

function SectionTitle({ icon, children, hint }) {
  return (
    <div className="flex items-center gap-2 mt-7 mb-3">
      <span className="text-lg">{icon}</span>
      <h4 className="font-display text-base font-semibold flex-1" style={{ color: 'var(--ink)' }}>
        {children}
      </h4>
      {hint && (
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Qo'shimcha grammatika izohlari */
export function GrammarMore({ items }) {
  if (!items?.length) return null;
  return (
    <div>
      <SectionTitle icon="📘" hint="Kengaytma">Qo'shimcha grammatika</SectionTitle>
      <div className="space-y-3">
        {items.map((g, i) => (
          <div key={i} className="rounded-xl border p-4 lesson-card" style={card}>
            <div className="font-display font-semibold mb-1.5" style={{ color: 'var(--pine)' }}>
              {i + 1}. {g.title}
            </div>
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink)' }}>{g.text}</p>
            <div className="space-y-1.5">
              {g.examples?.map((ex, k) => (
                <div key={k} className="text-sm flex gap-2 items-start rounded-lg px-3 py-2" style={{ background: 'var(--paper-soft)' }}>
                  <span className="font-mono flex-1" style={{ color: 'var(--ink)' }}>{ex[0]}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{ex[1]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ikkinchi dialog */
export function DialogExtra({ dialog, lang }) {
  const [showTr, setShowTr] = useState(true);
  if (!dialog?.lines?.length) return null;
  return (
    <div>
      <SectionTitle icon="💬" hint="2-dialog">{dialog.title}</SectionTitle>
      <label className="flex items-center gap-2 text-xs mb-3 cursor-pointer select-none" style={{ color: 'var(--ink-soft)' }}>
        <input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} />
        Tarjimani ko'rsatish
      </label>
      <div className="space-y-2.5">
        {dialog.lines.map(([speaker, line, tr], i) => {
          const right = i % 2 === 1;
          return (
            <div key={i} className={`flex gap-2 items-end ${right ? 'flex-row-reverse' : ''}`}>
              <span className="font-mono text-[10px] px-2 py-1 rounded-full shrink-0" style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}>
                {speaker}
              </span>
              <div
                className="rounded-2xl px-4 py-2.5 max-w-[85%] border"
                style={{
                  background: right ? 'var(--pine)' : 'var(--panel)',
                  color: right ? 'var(--paper)' : 'var(--ink)',
                  borderColor: right ? 'var(--pine)' : 'var(--line)',
                }}
              >
                <div className="text-sm">{line}</div>
                {showTr && (
                  <div className="text-xs mt-1 opacity-75">{tr}</div>
                )}
              </div>
              <SpeakButton text={line} lang={lang} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** O'qish matni + savollar */
export function ReadingBlock({ reading, lang }) {
  const [showTr, setShowTr] = useState(false);
  const [open, setOpen] = useState({});
  if (!reading) return null;
  return (
    <div>
      <SectionTitle icon="📖" hint="O'qish">{reading.title}</SectionTitle>
      <div className="rounded-xl border p-4 lesson-card" style={card}>
        <div className="flex gap-3 items-start">
          <p className="flex-1 leading-relaxed" style={{ color: 'var(--ink)' }}>{reading.text}</p>
          <SpeakButton text={reading.text} lang={lang} />
        </div>
        <button
          type="button"
          onClick={() => setShowTr((v) => !v)}
          className="mt-3 text-xs font-mono uppercase tracking-widest cursor-pointer"
          style={{ color: 'var(--gold)' }}
        >
          {showTr ? '▾ Tarjimani yashirish' : '▸ Tarjimani ko\'rsatish'}
        </button>
        {showTr && (
          <p className="mt-2 text-sm leading-relaxed rounded-lg p-3" style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}>
            {reading.uz}
          </p>
        )}
      </div>
      {reading.questions?.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>
            Tushunish savollari
          </div>
          {reading.questions.map(([q, a], i) => (
            <div key={i} className="rounded-xl border p-3" style={card}>
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{i + 1}. {q}</div>
              {open[i] ? (
                <div className="text-sm mt-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'var(--success-bg)', color: 'var(--ink)' }}>
                  ✅ {a}
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs font-mono uppercase tracking-widest mt-1.5 cursor-pointer"
                  style={{ color: 'var(--pine)' }}
                  onClick={() => setOpen((o) => ({ ...o, [i]: true }))}
                >
                  Javobni ko'rish
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kengaytirilgan so'zlar va iboralar: qidiruv, tarjimani yashirish, talaffuz */
export function WordsExplorer({ words = [], phrases = [], lang }) {
  const [tab, setTab] = useState(words.length ? 'words' : 'phrases');
  const [q, setQ] = useState('');
  const [hide, setHide] = useState(false);
  const [limit, setLimit] = useState(24);

  const list = tab === 'words' ? words : phrases;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) => r[0].toLowerCase().includes(s) || r[1].toLowerCase().includes(s));
  }, [list, q]);

  if (!words.length && !phrases.length) return null;

  const tabBtn = (key, label, n) => (
    <button
      type="button"
      key={key}
      onClick={() => { setTab(key); setLimit(24); }}
      className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-colors"
      style={{
        background: tab === key ? 'var(--pine)' : 'var(--paper-soft)',
        color: tab === key ? 'var(--paper)' : 'var(--ink-soft)',
      }}
    >
      {label} <span className="font-mono text-xs opacity-80">{n}</span>
    </button>
  );

  return (
    <div>
      <SectionTitle icon="🗂️" hint="Kengaytirilgan lug'at">Gaplar bilan so'zlar va iboralar</SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {words.length > 0 && tabBtn('words', "So'zlar", words.length)}
        {phrases.length > 0 && tabBtn('phrases', 'Iboralar', phrases.length)}
        <label className="ml-auto flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--ink-soft)' }}>
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          Tarjimani yashirish (o'zingizni sinang)
        </label>
      </div>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setLimit(24); }}
        placeholder="🔍 Qidirish…"
        className="w-full rounded-xl border px-4 py-2.5 text-sm mb-3 outline-none"
        style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
      />
      <div className="space-y-2">
        {filtered.slice(0, limit).map(([w, tr, sent, sentTr], i) => (
          <div key={w + i} className="rounded-xl border p-3.5 lesson-card" style={card}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display font-semibold text-base" style={{ color: 'var(--ink)' }}>{w}</span>
                  <span
                    className="text-sm transition-all"
                    style={{ color: 'var(--gold)', filter: hide ? 'blur(6px)' : 'none' }}
                    onClick={(e) => { e.currentTarget.style.filter = 'none'; }}
                  >
                    {tr}
                  </span>
                </div>
                <div className="text-sm mt-1.5 italic" style={{ color: 'var(--ink)' }}>{sent}</div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--ink-soft)', filter: hide ? 'blur(5px)' : 'none' }}
                  onClick={(e) => { e.currentTarget.style.filter = 'none'; }}
                >
                  {sentTr}
                </div>
              </div>
              <SpeakButton text={sent || w} lang={lang} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-center py-6" style={{ color: 'var(--ink-soft)' }}>Hech narsa topilmadi.</div>
        )}
      </div>
      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 24)}
          className="mt-3 w-full rounded-xl border py-2.5 text-sm font-semibold cursor-pointer"
          style={{ borderColor: 'var(--line)', color: 'var(--pine)', background: 'var(--panel)' }}
        >
          Yana ko'rsatish ({filtered.length - limit} ta qoldi)
        </button>
      )}
    </div>
  );
}
