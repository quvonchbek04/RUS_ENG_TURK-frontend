import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useCurrentLang } from '../lib/hooks.js';
import { useTutor } from '../context/TutorContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { readingHint } from '../lib/translit.js';
import { langToBCP47 } from '../lib/tts.js';
import { AiText, LANG_OPTIONS } from './ui.jsx';

const QUICK = [
  { icon: '💡', text: 'Shu mavzuni sodda qilib tushuntirib ber', needsContext: true },
  { icon: '🧪', text: "Menga shu mavzu bo'yicha 5 ta test savoli ber", needsContext: true },
  { icon: '✍️', text: 'Gapimni tekshir: ' },
  { icon: '🔎', text: "Bu so'z nimani anglatadi: " },
  { icon: '🗣️', text: "Keling, oddiy suhbat mashqi qilamiz — sen savol ber, men javob beraman" },
  { icon: '📝', text: 'Menga bugun uchun 10 ta foydali so\'z va misol gaplar ber' },
];

const storageKey = (lang) => `til_tutor_${lang}`;

function loadHistory(lang) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(lang)) || '[]');
  } catch {
    return [];
  }
}

/** AI kalit bo'lmaganda: xabardagi so'zlarni kurs lug'atidan qidiradi. */
async function localLookup(lang, message) {
  const data = await api.content(lang);
  const rows = [];
  data.modules.forEach((mod) => mod.months.forEach((m) => (m.vocab || []).forEach((v) => rows.push([v[0], v[2]]))));
  (data.wordbank || []).forEach((c) => c.rows.forEach((r) => rows.push([r[0], r[1], r[2], r[3]])));
  (data.phrasebank || []).forEach((c) => c.rows.forEach((r) => rows.push([r[0], r[1], r[2], r[3]])));
  (data.dictExtra || []).forEach((c) => c.words.forEach((w) => rows.push([w[0], w[2]])));
  const terms = String(message)
    .replace(/^(bu so'z nimani anglatadi|gapimni tekshir|tarjima)[:\s]*/i, '')
    .toLowerCase()
    .split(/[\s,.;!?:"'«»()]+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  const found = [];
  const seen = new Set();
  for (const t of terms) {
    for (const r of rows) {
      const w = String(r[0]).toLowerCase();
      const m = String(r[1]).toLowerCase();
      if (w === t || m === t || m.split(/[,/;]\s*/).includes(t)) {
        const key = w + '|' + m;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(r);
        if (found.length >= 8) break;
      }
    }
  }
  if (!found.length) return null;
  return found
    .map((r) => {
      const hint = readingHint(r[0], lang);
      return `- **${r[0]}**${hint ? ` (${hint})` : ''} — ${r[1]}${r[2] ? `\n  Misol: ${r[2]}${r[3] ? ` (${r[3]})` : ''}` : ''}`;
    })
    .join('\n');
}

export default function AiTutorPanel({ compact = false, onClose }) {
  const routeLang = useCurrentLang();
  const { context, draft, setDraft } = useTutor();
  const { updateProgress } = useAuth();
  const [lang, setLang] = useState(context?.lang || routeLang);
  const [messages, setMessages] = useState(() => loadHistory(context?.lang || routeLang));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [useContext, setUseContext] = useState(true);
  const [listening, setListening] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);

  const SpeechRec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  useEffect(() => {
    api.aiStatus().then(setStatus).catch(() => setStatus({ provider: 'unknown' }));
  }, []);

  useEffect(() => {
    setMessages(loadHistory(lang));
  }, [lang]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(lang), JSON.stringify(messages.slice(-40)));
    } catch {
      /* e'tiborsiz */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, lang]);

  useEffect(() => {
    if (draft) {
      setInput(draft);
      setDraft('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [draft, setDraft]);

  const activeContext = context && useContext && context.lang === lang ? context : null;

  const quick = useMemo(() => QUICK.filter((q) => !q.needsContext || activeContext), [activeContext]);

  async function send(textArg) {
    const text = String(textArg ?? input).trim();
    if (!text || busy) return;
    if (/[:]\s*$/.test(text)) {
      setInput(text + ' ');
      inputRef.current?.focus();
      return;
    }
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await api.aiChat({
        lang,
        messages: next.map(({ role, content }) => ({ role, content })),
        context: activeContext ? { title: activeContext.title, text: activeContext.text } : null,
      });
      let reply = res.reply;
      if (res.mock) {
        const local = await localLookup(lang, text).catch(() => null);
        reply = local ? `**Lug'atdan topilganlar:**\n\n${local}\n\n${res.reply}` : res.reply;
      }
      setMessages((m) => [...m, { role: 'assistant', content: reply || '…', mock: !!res.mock }]);
      updateProgress((prev) => {
        const aiStats = { ...(prev.aiStats || {}) };
        const s = { ...(aiStats[lang] || { attempts: 0, correct: 0, chats: 0 }) };
        s.chats = (s.chats || 0) + 1;
        aiStats[lang] = s;
        return { ...prev, aiStats };
      });
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (!SpeechRec) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRec();
    rec.lang = langToBCP47(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript || '';
      setInput((v) => (v ? v + ' ' : '') + said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const statusBadge =
    status?.provider === 'mock' ? (
      <span className="badge badge-gold" title="Administrator API kalit qo'shganda to'liq AI rejimi yoqiladi">Oddiy rejim</span>
    ) : status?.provider && status.provider !== 'unknown' ? (
      <span className="badge badge-pine">AI faol</span>
    ) : null;

  return (
    <div className={`flex flex-col h-full min-h-0 ${compact ? '' : 'card overflow-hidden'}`} style={{ minHeight: compact ? undefined : '70vh' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--grad-brand)' }}>
          🤖
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight" style={{ color: 'var(--ink)' }}>
            AI ustoz
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {statusBadge}
            {status?.dailyLimit > 0 && (
              <span className="text-[11px] faint">
                bugun {status.usedToday || 0}/{status.dailyLimit}
              </span>
            )}
          </div>
        </div>
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="select !w-auto !py-1.5 !px-2 text-sm" aria-label="Til">
          {LANG_OPTIONS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.flag} {l.short}
            </option>
          ))}
        </select>
        {messages.length > 0 && (
          <button type="button" className="btn btn-ghost btn-icon" title="Suhbatni tozalash" onClick={() => setMessages([])}>
            🧹
          </button>
        )}
        {onClose && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Yopish">
            ✕
          </button>
        )}
      </div>

      {context && context.lang === lang && (
        <label className="flex items-center gap-2 px-4 py-2 text-xs border-b cursor-pointer" style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}>
          <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
          <span className="truncate muted">
            📘 Hozirgi mavzu: <b style={{ color: 'var(--ink)' }}>{context.title}</b>
          </span>
        </label>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">👋</div>
            <div className="font-bold" style={{ color: 'var(--ink)' }}>
              Salom! Men sizning shaxsiy til ustozingizman.
            </div>
            <p className="text-sm muted mt-1 max-w-sm mx-auto">
              Grammatikani tushuntiraman, gaplaringizni tekshiraman, savollar beraman va suhbat mashqi qilamiz. O'zbek tilida yozavering.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed"
              style={
                m.role === 'user'
                  ? { background: 'var(--pine)', color: '#fff', borderBottomRightRadius: 6 }
                  : {
                      background: m.error ? 'var(--error-bg)' : 'var(--panel-2)',
                      color: m.error ? 'var(--brick)' : 'var(--ink)',
                      border: '1px solid var(--line)',
                      borderBottomLeftRadius: 6,
                    }
              }
            >
              {m.role === 'user' ? <span className="whitespace-pre-wrap">{m.content}</span> : <AiText text={m.content} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 text-sm muted flex items-center gap-2" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
              <span className="spinner" /> Ustoz yozmoqda…
            </div>
          </div>
        )}
      </div>

      <div className="border-t px-3 pt-2.5" style={{ borderColor: 'var(--line)', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
        <div className="tabs mb-2">
          {quick.map((q) => (
            <button key={q.text} type="button" className="chip !py-1.5 !text-xs" onClick={() => send(q.text)} disabled={busy}>
              {q.icon} {q.text.replace(/[:]\s*$/, '')}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Savolingizni yozing…"
            className="textarea !min-h-[46px] max-h-32 !py-2.5"
          />
          {SpeechRec && (
            <button
              type="button"
              onClick={toggleMic}
              className={`btn btn-icon !w-[46px] !h-[46px] ${listening ? 'btn-danger' : 'btn-ghost'}`}
              title={`Ovoz bilan yozish (${LANG_OPTIONS.find((l) => l.key === lang)?.label})`}
            >
              {listening ? '⏺' : '🎙️'}
            </button>
          )}
          <button type="button" onClick={() => send()} disabled={busy || !input.trim()} className="btn btn-primary btn-icon !w-[46px] !h-[46px]" aria-label="Yuborish">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
