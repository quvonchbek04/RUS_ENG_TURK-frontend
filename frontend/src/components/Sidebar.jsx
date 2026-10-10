import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useCurrentLang, useTheme } from '../lib/hooks.js';
import { MEDIA_META, MEDIA_ORDER } from '../lib/media.js';
import { isAdminRole, getStreak } from '../lib/lessonProgress.js';
import { can } from '../lib/roles.js';
import { t } from '../i18n/index.js';
import { LanguageSwitcher } from '../i18n/react.jsx';
import { LANG_OPTIONS } from './ui.jsx';

function NavRow({ icon, label, to, active, collapsed, onClick, count, accent }) {
  const cls =
    'flex items-center gap-3 rounded-xl transition-colors cursor-pointer select-none ' +
    (collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2');
  const style = {
    color: active ? 'var(--pine)' : 'var(--ink)',
    background: active ? 'var(--pine-soft)' : 'transparent',
    fontWeight: active ? 700 : 600,
  };
  const inner = (
    <>
      <span className="w-5 text-center shrink-0 text-[17px] leading-none">{icon}</span>
      {!collapsed && <span className="text-[13.5px] truncate flex-1">{label}</span>}
      {!collapsed && count != null && count > 0 && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: accent ? 'var(--gold-soft)' : 'var(--paper-soft)', color: accent ? 'var(--gold)' : 'var(--ink-soft)' }}>
          {count}
        </span>
      )}
    </>
  );
  const hover = {
    onMouseEnter: (e) => !active && (e.currentTarget.style.background = 'var(--paper-soft)'),
    onMouseLeave: (e) => !active && (e.currentTarget.style.background = 'transparent'),
  };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls + ' w-full text-left'} style={style} title={collapsed ? label : undefined} {...hover}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={to} className={cls} style={style} title={collapsed ? label : undefined} {...hover}>
      {inner}
    </Link>
  );
}

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="h-px my-3 mx-3" style={{ background: 'var(--line)' }} />;
  return <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] px-3 pt-5 pb-1.5 faint">{children}</div>;
}

export default function Sidebar({ collapsed = false, onToggleCollapse, onNavigate, mobile = false }) {
  const { user, logout, progress } = useAuth();
  const navigate = useNavigate();
  const lang = useCurrentLang();
  const { pathname, search } = useLocation();
  const adminTab = new URLSearchParams(search).get('tab');
  const [theme, toggleTheme] = useTheme();
  const [counts, setCounts] = useState({});
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    api.mediaCounts().then(setCounts).catch(() => {});
    api.meta().then(setMeta).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    onNavigate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!user) return null;
  const isStaff = isAdminRole(user.role);
  const isSuper = user.role === 'superadmin';
  const streak = getStreak(progress);
  const langInfo = meta?.LANGS?.[lang];
  const is = (p) => pathname === p;

  return (
    <div
      className="h-full flex flex-col border-r"
      style={{ borderColor: 'var(--line)', background: 'var(--panel)', width: collapsed ? 72 : 264 }}
    >
      {/* Brend */}
      <div className={'flex items-center gap-2.5 px-4 pt-4 pb-3 ' + (collapsed ? 'justify-center px-2' : '')}>
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <img src="/icon.svg" alt="" className="w-9 h-9 rounded-xl shrink-0" />
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <div className="font-display font-semibold text-[17px] truncate" style={{ color: 'var(--ink)' }}>
                Til sayohati
              </div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase faint truncate">EN · RU · TR</div>
            </div>
          )}
        </Link>
        {!mobile && !collapsed && (
          <button type="button" onClick={onToggleCollapse} className="ml-auto btn btn-ghost btn-icon !w-8 !h-8 !min-h-8 text-xs" title={t("Panelni yig'ish")}>
            «
          </button>
        )}
      </div>
      {!mobile && collapsed && (
        <button type="button" onClick={onToggleCollapse} className="mx-auto mb-1 btn btn-ghost btn-icon !w-8 !h-8 !min-h-8 text-xs" title={t('Panelni kengaytirish')}>
          »
        </button>
      )}

      {/* O'rganiladigan til tanlash */}
      <div className={collapsed ? 'flex flex-col items-center gap-1.5 px-2 pb-2' : 'grid grid-cols-3 gap-1.5 px-3 pb-2'}>
        {LANG_OPTIONS.map((l) => {
          const active = lang === l.key;
          return (
            <Link
              key={l.key}
              to={`/lang/${l.key}`}
              className={'flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-colors ' + (collapsed ? 'w-10 h-10' : 'h-10')}
              style={{
                background: active ? 'var(--gold-soft)' : 'var(--panel-2)',
                border: `1px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                color: active ? 'var(--ink)' : 'var(--ink-soft)',
              }}
              title={l.label}
            >
              <span className="text-lg leading-none">{l.flag}</span>
              {!collapsed && <span className="text-[11px]">{l.short}</span>}
            </Link>
          );
        })}
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-4">
        <SectionLabel collapsed={collapsed}>{t('Asosiy')}</SectionLabel>
        <NavRow icon="🏠" label={t('Bosh sahifa')} to="/" active={is('/')} collapsed={collapsed} />
        <NavRow
          icon="🧭"
          label={langInfo ? t('Darslar · {name}', { name: t(langInfo.label) }) : t('Darslar')}
          to={`/lang/${lang}`}
          active={is(`/lang/${lang}`) || pathname.includes('/month/')}
          collapsed={collapsed}
        />
        <NavRow icon="🤖" label={t('AI ustoz')} to="/ai" active={is('/ai')} collapsed={collapsed} />
        <NavRow icon="📊" label={t('Natijalar')} to="/results" active={is('/results')} collapsed={collapsed} />

        <SectionLabel collapsed={collapsed}>{t("Mashg'ulotlar")}</SectionLabel>
        <NavRow icon="🔀" label={t("Lug'at mashqi")} to={`/lang/${lang}/practice-full`} active={is(`/lang/${lang}/practice-full`)} collapsed={collapsed} />
        <NavRow icon="📖" label={t("Lug'at")} to={`/lang/${lang}/dictionary`} active={is(`/lang/${lang}/dictionary`)} collapsed={collapsed} />
        <NavRow icon="🎧" label={t('Dialog mashqi')} to={`/lang/${lang}/dialogs`} active={is(`/lang/${lang}/dialogs`)} collapsed={collapsed} />
        <NavRow icon="📐" label={t('Grammatika')} to={`/lang/${lang}/grammar`} active={is(`/lang/${lang}/grammar`)} collapsed={collapsed} />
        <NavRow icon="🔤" label={t("Fe'llar jadvali")} to={`/lang/${lang}/verbs`} active={is(`/lang/${lang}/verbs`)} collapsed={collapsed} />

        <SectionLabel collapsed={collapsed}>{t('Materiallar')}</SectionLabel>
        {MEDIA_ORDER.map((k) => (
          <NavRow
            key={k}
            icon={MEDIA_META[k].icon}
            label={MEDIA_META[k].label}
            to={`/media/${k}`}
            active={is(`/media/${k}`)}
            collapsed={collapsed}
            count={counts[k]}
            accent={k === 'news'}
          />
        ))}

        {isStaff && (
          <>
            <SectionLabel collapsed={collapsed}>{t('Boshqaruv')}</SectionLabel>
            <NavRow icon="👑" label={t('Admin panel')} to="/admin" active={is('/admin') && (!adminTab || adminTab === 'home')} collapsed={collapsed} />
            {can(user, 'users_view') && (
              <NavRow icon="👥" label={t('Foydalanuvchilar')} to="/admin?tab=users" active={is('/admin') && adminTab === 'users'} collapsed={collapsed} />
            )}
            {isSuper && (
              <>
                <NavRow icon="🔐" label={t('Adminlar ruxsatlari')} to="/admin?tab=perms" active={is('/admin') && adminTab === 'perms'} collapsed={collapsed} />
                <NavRow icon="🛡️" label={t("Ro'yxatdan o'tish")} to="/admin?tab=signup" active={is('/admin') && adminTab === 'signup'} collapsed={collapsed} />
              </>
            )}
            {can(user, 'ai_view') && (
              <NavRow icon="🔑" label={t('AI va API kalitlar')} to="/admin?tab=ai" active={is('/admin') && adminTab === 'ai'} collapsed={collapsed} />
            )}
            {!isSuper && <NavRow icon="🔐" label={t('Mening ruxsatlarim')} to="/profile#perms" active={false} collapsed={collapsed} />}
          </>
        )}
      </nav>

      {/* Pastki qism */}
      <div className="border-t p-2 space-y-1" style={{ borderColor: 'var(--line)', paddingBottom: mobile ? 'calc(8px + env(safe-area-inset-bottom))' : undefined }}>
        {collapsed ? <LanguageSwitcher variant="cycle" className="mx-auto" /> : <LanguageSwitcher className="px-1 pb-1" />}
        <NavRow icon={theme === 'dark' ? '☀️' : '🌙'} label={theme === 'dark' ? t('Kunduzgi rejim') : t('Tungi rejim')} onClick={toggleTheme} collapsed={collapsed} />
        {collapsed ? (
          <NavRow icon="👤" label={t('Profil')} to="/profile" active={is('/profile')} collapsed />
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl" style={{ background: is('/profile') ? 'var(--pine-soft)' : 'transparent' }}>
            <Link to="/profile" className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'var(--grad-brand)', color: '#fff' }}
              >
                {(user.displayName || user.username || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[13px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {user.displayName || user.username}
                </span>
                <span className="block text-[11px] faint truncate">
                  {streak > 0 ? t('🔥 {n} kun ketma-ket', { n: streak }) : isSuper ? t('Super admin') : user.role === 'admin' ? t('Admin') : t("O'quvchi")}
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="btn btn-ghost btn-icon !w-9 !h-9 !min-h-9 shrink-0"
              title={t('Chiqish')}
              aria-label={t('Chiqish')}
              style={{ color: 'var(--brick)' }}
            >
              ⎋
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
