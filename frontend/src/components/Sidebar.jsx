import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { flattenMonths, isMonthDone } from '../lib/lessonProgress.js';

const LANG_FLAGS = { ru: '🇷🇺', en: '🇬🇧', tr: '🇹🇷' };

function useCurrentLang() {
  const { pathname } = useLocation();
  const m = pathname.match(/^\/lang\/([a-z]{2})/);
  return m ? m[1] : null;
}

function NavRow({ icon, label, to, active, collapsed, onClick }) {
  const cls =
    'flex items-center gap-3 rounded-lg transition-colors group cursor-pointer ' +
    (collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2.5');
  const style = {
    color: active ? 'var(--pine)' : 'var(--ink)',
    background: active ? 'var(--gold-soft)' : 'transparent',
    fontWeight: active ? 600 : 500,
  };
  const hoverProps = active
    ? {}
    : {
        onMouseEnter: (e) => (e.currentTarget.style.background = 'var(--paper-soft)'),
        onMouseLeave: (e) => (e.currentTarget.style.background = 'transparent'),
      };

  const inner = (
    <>
      <span className="w-5 text-center shrink-0 text-base">{icon}</span>
      {!collapsed && <span className="text-sm truncate">{label}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls + ' w-full text-left'} style={style} {...hoverProps} title={collapsed ? label : undefined}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={to} className={cls} style={style} {...hoverProps} title={collapsed ? label : undefined}>
      {inner}
    </Link>
  );
}

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="h-px my-2" style={{ background: 'var(--line)' }} />;
  return (
    <div className="font-mono text-[10px] uppercase tracking-widest px-2.5 pt-4 pb-1.5" style={{ color: 'var(--ink-soft)' }}>
      {children}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout, progress } = useAuth();
  const navigate = useNavigate();
  const lang = useCurrentLang();
  const { pathname } = useLocation();
  const [langs, setLangs] = useState(null);
  const [content, setContent] = useState(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('til_sidebar_collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    api.langs().then((r) => setLangs(r.langs)).catch(() => {});
  }, []);

  useEffect(() => {
    setContent(null);
    if (lang) api.content(lang).then(setContent).catch(() => {});
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('til_sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!user) return null;

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const dialogCount = content ? content.modules.reduce((s, m) => s + m.months.filter((mm) => mm.dialog).length, 0) + (content.dialogsExtra?.length || 0) : null;
  const grammarCount = content ? content.modules.reduce((s, m) => s + m.months.filter((mm) => mm.grammar).length, 0) : null;
  const courseVocabCount = content ? content.modules.reduce((s, m) => s + m.months.reduce((s2, mm) => s2 + (mm.vocab?.length || 0), 0), 0) : null;
  const dictExtraCount = content ? (content.dictExtra || []).reduce((s, c) => s + c.words.length, 0) : null;
  const totalVocabCount = courseVocabCount != null && dictExtraCount != null ? courseVocabCount + dictExtraCount : null;
  const nextMonth = content ? (() => {
    const flat = flattenMonths(content.modules);
    return flat.find((m) => !isMonthDone(progress, lang, m.id)) || flat[flat.length - 1];
  })() : null;

  function renderBody(collapsedOverride) {
    const collapsedEff = collapsedOverride;
    return (
    <div
      className="h-full flex flex-col shrink-0 border-r transition-[width] duration-150"
      style={{ borderColor: 'var(--line)', background: 'var(--paper-soft)', width: collapsedEff ? 64 : 240 }}
    >
      {/* Logo / brend */}
      <div className={'flex items-center gap-2.5 px-3 py-4 ' + (collapsedEff ? 'justify-center' : '')}>
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: 'var(--pine)', color: 'var(--paper)' }}
          >
            🎫
          </span>
          {!collapsedEff && (
            <div className="leading-tight min-w-0">
              <div className="font-display font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>
                Til sayohati
              </div>
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase truncate" style={{ color: 'var(--ink-soft)' }}>
                Yo'lovchi biletlari
              </div>
            </div>
          )}
        </Link>
        {collapsedOverride === collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer shrink-0 hidden lg:flex"
            style={{ color: 'var(--ink-soft)' }}
            title={collapsedEff ? 'Panelni kengaytirish' : "Panelni yig'ish"}
          >
            {collapsedEff ? '»' : '«'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-panel px-2 pb-3">
        <NavRow icon="🏠" label="Bosh sahifa" to="/" active={pathname === '/'} collapsed={collapsedEff} />
        <NavRow icon="📚" label="Kutubxona" to="/library" active={pathname === '/library'} collapsed={collapsedEff} />
        {isAdmin && <NavRow icon="👑" label="Admin panel" to="/admin" active={pathname === '/admin'} collapsed={collapsedEff} />}

        <SectionLabel collapsed={collapsedEff}>Yo'nalish</SectionLabel>
        <div className={collapsedEff ? 'flex flex-col gap-1 items-center' : 'flex gap-1.5 px-1'}>
          {langs &&
            Object.values(langs).map((l) => (
              <Link
                key={l.key}
                to={`/lang/${l.key}`}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors shrink-0"
                style={{
                  background: lang === l.key ? 'var(--gold-soft)' : 'transparent',
                  border: lang === l.key ? '1px solid var(--gold)' : '1px solid var(--line)',
                }}
                title={l.title}
              >
                {l.flag || LANG_FLAGS[l.key] || '🏳️'}
              </Link>
            ))}
        </div>

        {lang && content && (
          <>
            <SectionLabel collapsed={collapsedEff}>{content.meta.title}</SectionLabel>
            <NavRow icon="📘" label="Darslar" to={`/lang/${lang}`} active={pathname === `/lang/${lang}`} collapsed={collapsedEff} />
            <NavRow
              icon="🎧"
              label={collapsedEff ? 'Dialog' : `Dialog mashqi${dialogCount != null ? ` · ${dialogCount}` : ''}`}
              to={`/lang/${lang}/dialogs`}
              active={pathname === `/lang/${lang}/dialogs`}
              collapsed={collapsedEff}
            />
            <NavRow
              icon="📐"
              label={collapsedEff ? 'Grammatika' : `Grammatika${grammarCount != null ? ` · ${grammarCount}` : ''}`}
              to={`/lang/${lang}/grammar`}
              active={pathname === `/lang/${lang}/grammar`}
              collapsed={collapsedEff}
            />
            <NavRow
              icon="🔤"
              label={collapsedEff ? "Fe'llar" : `Fe'llar lug'ati${content.verbTable ? ` · ${content.verbTable.length}` : ''}`}
              to={`/lang/${lang}/verbs`}
              active={pathname === `/lang/${lang}/verbs`}
              collapsed={collapsedEff}
            />
            {nextMonth && (
              <NavRow
                icon="🔀"
                label={collapsedEff ? "Lug'at" : `Lug'at mashqi${totalVocabCount != null ? ` · ${totalVocabCount}` : ''}`}
                to={`/lang/${lang}/practice-full`}
                active={pathname === `/lang/${lang}/practice-full`}
                collapsed={collapsedEff}
              />
            )}
            <NavRow
              icon="📖"
              label={collapsedEff ? 'Lug\'at' : `To'liq lug'at${dictExtraCount != null ? ` · ${dictExtraCount}` : ''}`}
              to={`/lang/${lang}/dictionary`}
              active={pathname === `/lang/${lang}/dictionary`}
              collapsed={collapsedEff}
            />
          </>
        )}
      </div>

      {/* Pastki qism — foydalanuvchi */}
      <div className="border-t p-2" style={{ borderColor: 'var(--line)' }}>
        {!collapsedEff ? (
          <div className="flex items-center gap-2 px-1 py-1.5">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: 'var(--gold-soft)', color: 'var(--ink)' }}
            >
              {(user.displayName || user.username || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {user.displayName || user.username}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-1.5 rounded-lg cursor-pointer shrink-0"
              style={{ color: 'var(--brick)' }}
              title="Chiqish"
            >
              Chiqish
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center justify-center py-2 rounded-lg cursor-pointer"
            style={{ color: 'var(--brick)' }}
            title="Chiqish"
          >
            ⎋
          </button>
        )}
      </div>
    </div>
    );
  }

  return (
    <>
      {/* Mobil tepa panel — hamburger tugmasi */}
      <div
        className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(6px)' }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ color: 'var(--ink)' }}
        >
          ☰
        </button>
        <span className="font-display font-semibold" style={{ color: 'var(--ink)' }}>
          Til sayohati
        </span>
      </div>

      {/* Desktop — doimiy sidebar */}
      <div className="hidden lg:block h-screen sticky top-0">{renderBody(collapsed)}</div>

      {/* Mobil — overlay sidebar (doim to'liq kengaytirilgan holda) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex" onClick={() => setMobileOpen(false)}>
          <div style={{ background: 'rgba(20,20,19,0.5)' }} className="absolute inset-0" />
          <div className="relative h-full" onClick={(e) => e.stopPropagation()}>
            {renderBody(false)}
          </div>
        </div>
      )}
    </>
  );
}
