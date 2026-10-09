import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export const LANG_OPTIONS = [
  { key: 'en', flag: '🇬🇧', label: 'Ingliz tili', short: 'EN' },
  { key: 'ru', flag: '🇷🇺', label: 'Rus tili', short: 'RU' },
  { key: 'tr', flag: '🇹🇷', label: 'Turk tili', short: 'TR' },
];
export const LANG_BY_KEY = Object.fromEntries(LANG_OPTIONS.map((l) => [l.key, l]));

export function PageLoading({ label = 'Yuklanmoqda…' }) {
  return (
    <div className="page-narrow">
      <div className="skeleton h-6 w-40 mb-4" />
      <div className="skeleton h-10 w-2/3 mb-8" />
      <div className="space-y-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBox({ children, className = '' }) {
  if (!children) return null;
  return <div className={`alert alert-error ${className}`}>{children}</div>;
}

export function Notice({ type = 'info', children, className = '' }) {
  if (!children) return null;
  return <div className={`alert alert-${type} ${className}`}>{children}</div>;
}

export function EmptyState({ icon = '🗂️', title, text, action }) {
  return (
    <div className="card text-center px-6 py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="h2 mb-1">{title}</div>
      {text && <p className="muted text-sm max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, back, actions }) {
  return (
    <div className="mb-6">
      {back && (
        <Link to={back.to} className="back-link mb-3">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="muted mt-2 max-w-2xl">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="overlay anim-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`sheet anim-up flex flex-col left-0 right-0 bottom-0 max-h-[92vh] rounded-t-3xl sm:rounded-3xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[calc(100%-32px)] ${wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="h2 flex-1 min-w-0 truncate">{title}</div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Yopish">
            ✕
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--line)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

export function StatCard({ icon, label, value, tone = 'pine' }) {
  const bg = { pine: 'var(--pine-soft)', gold: 'var(--gold-soft)', sky: 'var(--sky-soft)', brick: 'var(--brick-soft)' }[tone];
  return (
    <div className="stat-tile px-4 py-3.5 flex items-center gap-3">
      <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: bg }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-semibold leading-none" style={{ color: 'var(--ink)' }}>
          {value}
        </div>
        <div className="text-[10.5px] font-bold uppercase tracking-wide mt-1.5 muted leading-tight line-clamp-2">{label}</div>
      </div>
    </div>
  );
}

export function LangChips({ value, onChange, withAll = false }) {
  const items = withAll ? [{ key: 'all', flag: '🌐', label: 'Barchasi' }, ...LANG_OPTIONS] : LANG_OPTIONS;
  return (
    <div className="tabs">
      {items.map((l) => (
        <button key={l.key} type="button" className={`chip ${value === l.key ? 'chip-active' : ''}`} onClick={() => onChange(l.key)}>
          <span>{l.flag}</span> {l.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, className = '' }) {
  return (
    <div className={`progress-track ${className}`}>
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** AI javobi uchun juda sodda markdown: **qalin**, "- " ro'yxat, bo'sh qator — paragraf. */
export function AiText({ text }) {
  const blocks = String(text || '').trim().split(/\n{2,}/);
  const inline = (s, key) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong> : <span key={`${key}-${i}`}>{p.replace(/^#+\s*/, '')}</span>
    );
  };
  return (
    <div className="ai-text">
      {blocks.map((b, bi) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <span key={li}>
                {inline(l.replace(/^\s*[-*•]\s+/, '• '), `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(d).slice(0, 10);
  }
}

export function formatDateTime(d) {
  if (!d) return '';
  try {
    const x = new Date(d);
    return `${x.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })} ${x.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return String(d);
  }
}
