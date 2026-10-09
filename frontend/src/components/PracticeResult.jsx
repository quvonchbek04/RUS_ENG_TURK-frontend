import { useState } from 'react';
import { Link } from 'react-router-dom';
import SpeakButton from './SpeakButton.jsx';
import { readingHint } from '../lib/translit.js';
import { MODES } from '../lib/practice.js';
import { formatDateTime } from './ui.jsx';

function pct(r) {
  return r.total ? Math.round((r.correct / r.total) * 100) : 0;
}

function fmtDuration(sec) {
  if (!sec) return '0 s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} daq ${s} s` : `${s} s`;
}

function ScoreRing({ value }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? 'var(--pine)' : value >= 60 ? 'var(--gold)' : 'var(--brick)';
  return (
    <svg viewBox="0 0 110 110" className="w-28 h-28 shrink-0" role="img" aria-label={`${value}%`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--paper-soft)" strokeWidth="10" />
      <circle
        cx="55"
        cy="55"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform="rotate(-90 55 55)"
      />
      <text x="55" y="61" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--ink)" fontFamily="Fraunces, Georgia, serif">
        {value}%
      </text>
    </svg>
  );
}

function WordRow({ it, lang, kind }) {
  const hint = readingHint(it.w, lang) || it.t;
  return (
    <div className="card-soft p-3.5 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display font-semibold text-[17px]" style={{ color: 'var(--ink)' }}>
            {it.w}
          </span>
          {hint && hint !== it.w && <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>{hint}</span>}
        </div>
        <div className="text-sm mt-0.5" style={{ color: 'var(--pine)' }}>
          ✓ {it.m}
        </div>
        {kind === 'mistake' && (
          <div className="text-sm mt-0.5" style={{ color: 'var(--brick)' }}>
            ✗ Sizning javobingiz: {it.g ? <b>{it.g}</b> : <i>javob berilmadi</i>}
            {it.qm && <span className="faint text-xs"> · {MODES[it.qm]?.label}</span>}
          </div>
        )}
        {it.s && (
          <div className="text-[13px] italic mt-1.5" style={{ color: 'var(--ink)' }}>
            {it.s}
            {it.st && <span className="not-italic muted"> — {it.st}</span>}
          </div>
        )}
      </div>
      <SpeakButton text={it.w} lang={lang} />
    </div>
  );
}

/** Mashq natijasi: umumiy ball va xatolar ro'yxati alohida. */
export default function PracticeResult({ record, onRetryMistakes, onRestart, extraActions, showHistoryLink = true }) {
  const mistakes = record.mistakes || [];
  const skipped = record.skipped || [];
  const okList = record.okList || [];
  const [tab, setTab] = useState(mistakes.length ? 'mistakes' : skipped.length ? 'skipped' : 'ok');
  const value = pct(record);
  // Dars testida javob berilmaganlar ham xato hisoblanadi; erkin mashqda — faqat haqiqiy xatolar
  const strict = record.planned && record.total === record.planned;
  const retryList = strict ? [...mistakes, ...skipped] : mistakes;

  const message =
    record.answered === 0
      ? "Hech bir savolga javob berilmadi."
      : value >= 90
        ? "A'lo! Juda yaxshi natija 🏆"
        : value >= 70
          ? 'Yaxshi natija! Xatolarni takrorlab oling 👍'
          : value >= 50
            ? "Yomon emas — xatolar ustida ishlash tavsiya etiladi 💪"
            : "Bu so'zlarni yana bir bor takrorlash kerak 📚";

  return (
    <div className="anim-rise">
      <div className="card p-5 sm:p-6 mb-5">
        <div className="flex flex-wrap items-center gap-5">
          <ScoreRing value={value} />
          <div className="flex-1 min-w-[200px]">
            <div className="eyebrow mb-1">Natija{record.early ? ' · muddatidan oldin to\'xtatildi' : ''}</div>
            <div className="h1 !text-2xl sm:!text-3xl">
              {record.correct} / {record.total} to'g'ri
            </div>
            <p className="muted mt-1 text-sm">{message}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="badge badge-pine">✓ {record.correct} to'g'ri</span>
              <span className="badge badge-brick">✗ {mistakes.length} xato</span>
              {skipped.length > 0 && <span className="badge">⏭ {skipped.length} javobsiz</span>}
              <span className="badge badge-sky">⏱ {fmtDuration(record.durationSec)}</span>
              {record.at && <span className="badge">{formatDateTime(record.at)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          {onRetryMistakes && retryList.length > 0 && (
            <button type="button" className="btn btn-gold" onClick={() => onRetryMistakes(retryList)}>
              🔁 Xatolar ustida ishlash ({retryList.length})
            </button>
          )}
          {onRestart && (
            <button type="button" className="btn btn-primary" onClick={onRestart}>
              ↺ Yangi mashq
            </button>
          )}
          {extraActions}
          {showHistoryLink && (
            <Link to="/results" className="btn btn-ghost">
              📊 Barcha natijalar
            </Link>
          )}
        </div>
      </div>

      <div className="tabs mb-3">
        <button type="button" className={`chip ${tab === 'mistakes' ? 'chip-active' : ''}`} onClick={() => setTab('mistakes')}>
          ❌ Xatolar · {mistakes.length}
        </button>
        {skipped.length > 0 && (
          <button type="button" className={`chip ${tab === 'skipped' ? 'chip-active' : ''}`} onClick={() => setTab('skipped')}>
            ⏭ Javobsiz · {skipped.length}
          </button>
        )}
        <button type="button" className={`chip ${tab === 'ok' ? 'chip-active' : ''}`} onClick={() => setTab('ok')}>
          ✅ To'g'rilar · {okList.length}
        </button>
      </div>

      <div className="space-y-2">
        {tab === 'mistakes' &&
          (mistakes.length ? (
            mistakes.map((it, i) => <WordRow key={i} it={it} lang={record.lang} kind="mistake" />)
          ) : (
            <div className="card-soft p-6 text-center muted">Xato yo'q — barakalla! 🎉</div>
          ))}
        {tab === 'skipped' && skipped.map((it, i) => <WordRow key={i} it={it} lang={record.lang} kind="skipped" />)}
        {tab === 'ok' &&
          (okList.length ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {okList.map(([w, m], i) => (
                <div key={i} className="card-soft px-3.5 py-2.5 flex items-center gap-2">
                  <span className="font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--ink)' }}>
                    {w}
                  </span>
                  <span className="text-sm muted truncate max-w-[50%]">{m}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-soft p-6 text-center muted">To'g'ri javoblar yo'q.</div>
          ))}
      </div>
    </div>
  );
}

export { pct as resultPct };
