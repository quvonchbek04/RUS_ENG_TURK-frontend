import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import AiTutorPanel from './AiTutorPanel.jsx';
import { useCurrentLang } from '../lib/hooks.js';
import { useTutor } from '../context/TutorContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function BottomNav({ onMenu }) {
  const { pathname } = useLocation();
  const lang = useCurrentLang();
  const { setOpen } = useTutor();
  const items = [
    { to: '/', icon: '🏠', label: 'Asosiy', active: pathname === '/' },
    { to: `/lang/${lang}`, icon: '🧭', label: 'Darslar', active: pathname === `/lang/${lang}` || pathname.includes('/month/') },
    { to: `/lang/${lang}/practice-full`, icon: '🔀', label: 'Mashq', active: pathname.includes('/practice') || pathname === '/results' },
  ];
  return (
    <nav className="bottom-nav lg:hidden" aria-label="Asosiy menyu">
      {items.map((it) => (
        <Link key={it.label} to={it.to} className={it.active ? 'active' : ''}>
          <span className="nav-ico">{it.icon}</span>
          {it.label}
        </Link>
      ))}
      <button type="button" onClick={() => setOpen(true)} className={pathname === '/ai' ? 'active' : ''}>
        <span className="nav-ico">🤖</span>
        AI ustoz
      </button>
      <button type="button" onClick={onMenu}>
        <span className="nav-ico">☰</span>
        Menyu
      </button>
    </nav>
  );
}

function TutorDrawer() {
  const { open, setOpen } = useTutor();
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === '/ai') setOpen(false);
  }, [pathname, setOpen]);
  if (!open) return null;
  return (
    <>
      <div className="overlay anim-fade" onClick={() => setOpen(false)} />
      <div className="sheet anim-up flex flex-col left-0 right-0 bottom-0 h-[88vh] rounded-t-3xl sm:left-auto sm:right-4 sm:bottom-4 sm:top-4 sm:h-auto sm:w-[420px] sm:rounded-3xl">
        <AiTutorPanel compact onClose={() => setOpen(false)} />
      </div>
    </>
  );
}

export default function Layout({ children, wide = false }) {
  const { user } = useAuth();
  const { open, setOpen } = useTutor();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('til_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('til_sidebar_collapsed', collapsed ? '1' : '0');
    } catch {
      /* e'tiborsiz */
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen flex app-bg">
      {/* Desktop — doimiy yon panel */}
      <aside className="hidden lg:block h-screen sticky top-0 shrink-0">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
      </aside>

      {/* Mobil — chiquvchi yon panel */}
      {mobileOpen && (
        <div className="lg:hidden">
          <div className="overlay anim-fade" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-[51] anim-right max-w-[86vw]" style={{ boxShadow: 'var(--shadow-md)' }}>
            <Sidebar mobile onNavigate={() => {}} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobil tepa panel */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 border-b"
          style={{
            borderColor: 'var(--line)',
            background: 'color-mix(in srgb, var(--panel) 90%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            paddingTop: 'env(safe-area-inset-top)',
            minHeight: 56,
          }}
        >
          <button type="button" onClick={() => setMobileOpen(true)} className="btn btn-ghost btn-icon" aria-label="Menyuni ochish">
            ☰
          </button>
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src="/icon.svg" alt="" className="w-7 h-7 rounded-lg" />
            <span className="font-display font-semibold truncate" style={{ color: 'var(--ink)' }}>
              Til sayohati
            </span>
          </Link>
          {user && (
            <Link to="/profile" className="ml-auto w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--grad-brand)', color: '#fff' }}>
              {(user.displayName || user.username || '?').slice(0, 1).toUpperCase()}
            </Link>
          )}
        </header>

        <main className={`flex-1 has-bottom-nav ${wide ? '' : ''}`}>{children}</main>

        <footer className="hidden lg:block border-t py-5" style={{ borderColor: 'var(--line)' }}>
          <div className="page-wide !py-0 text-xs faint flex flex-wrap gap-x-4 gap-y-1">
            <span>© Til sayohati — ingliz, rus va turk tillari o'zbek tilida</span>
            <span>Ctrl/⌘ + K — AI ustoz</span>
          </div>
        </footer>
      </div>

      {/* AI ustoz — suzuvchi tugma (desktop) */}
      {user && !open && pathname !== '/ai' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden lg:flex fixed right-6 bottom-6 z-30 btn btn-brand btn-lg !rounded-full shadow-lg"
          title="AI ustozdan so'rash"
        >
          🤖 AI ustoz
        </button>
      )}

      <BottomNav onMenu={() => setMobileOpen(true)} />
      <TutorDrawer />
      <KeyboardShortcut />
    </div>
  );
}

function KeyboardShortcut() {
  const { setOpen } = useTutor();
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
  return null;
}
