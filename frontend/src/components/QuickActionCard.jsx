import { Link } from 'react-router-dom';

export default function QuickActionCard({ icon, title, sub, to, onClick }) {
  const rowStyle = {
    color: 'var(--ink)',
  };
  const hoverProps = {
    onMouseEnter: (e) => (e.currentTarget.style.background = 'var(--paper-soft)'),
    onMouseLeave: (e) => (e.currentTarget.style.background = 'transparent'),
  };

  const inner = (
    <>
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
        style={{ background: 'var(--paper-soft)' }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight truncate">{title}</div>
        <div className="font-mono text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>
          {sub}
        </div>
      </div>
      <span
        className="font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ color: 'var(--gold)' }}
      >
        →
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-colors group cursor-pointer text-left w-full"
        style={rowStyle}
        {...hoverProps}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link to={to} className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-colors group" style={rowStyle} {...hoverProps}>
      {inner}
    </Link>
  );
}
