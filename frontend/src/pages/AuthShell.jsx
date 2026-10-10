import { Link } from 'react-router-dom';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { t } from '../i18n/index.js';
import { LanguageSwitcher, Rich } from '../i18n/react.jsx';

const FEATURES = [
  ['🇬🇧 🇷🇺 🇹🇷', "Uch til — o'zbek tilida tushuntirish bilan"],
  ['📘', 'A1 dan C1 gacha 33 ta bosqichma-bosqich dars'],
  ['🗂️', "2161 so'z va 297 ibora — misol gaplar bilan"],
  ['🤖', 'AI ustoz: vazifa beradi, javobingizni tekshiradi'],
];

/** Kirish / ro'yxatdan o'tish sahifalari uchun umumiy ramka (chapda brend, o'ngda forma). */
export default function AuthShell({ eyebrow, title, children, footer }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] app-bg">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden" style={{ background: 'var(--grad-brand)', color: '#fff' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 85% 10%, rgba(255,255,255,.18), transparent 40%), radial-gradient(circle at 0% 100%, rgba(240,168,80,.35), transparent 45%)' }}
        />
        <Link to="/" className="relative flex items-center gap-3">
          <img src="/icon.svg" alt="" className="w-11 h-11 rounded-2xl" />
          <span className="font-display text-2xl font-semibold">Til sayohati</span>
        </Link>
        <div className="relative">
          <div className="font-display text-5xl font-semibold leading-[1.08] mb-5">{t('Har kuni bir bekat — yangi tilga sayohat.')}</div>
          <div className="space-y-3 max-w-md">
            {FEATURES.map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,.12)' }}>
                <span className="text-xl shrink-0">{icon}</span>
                <span className="text-[15px] font-semibold">{t(text)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-3 text-xs font-bold tracking-[0.2em] opacity-80">
          <span>A1</span>
          <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.35)' }} />
          <span>C1</span>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:p-12">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between gap-3 mb-8">
            <Link to="/" className="lg:hidden flex items-center gap-2.5">
              <img src="/icon.svg" alt="" className="w-10 h-10 rounded-xl" />
              <span className="font-display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                Til sayohati
              </span>
            </Link>
            <LanguageSwitcher className="ml-auto" />
          </div>
          <div className="mb-7">
            <div className="eyebrow mb-2">{eyebrow}</div>
            <h1 className="h1">{title}</h1>
          </div>
          {!isSupabaseConfigured && (
            <div className="alert alert-warn mb-4 text-sm">
              <Rich text={t("⚙️ Supabase ulanmagan: **VITE_SUPABASE_URL** va **VITE_SUPABASE_ANON_KEY** o'zgaruvchilarini sozlang (DEPLOY.md ga qarang).")} />
            </div>
          )}
          {children}
          {footer && <div className="mt-6 text-sm muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function PasswordInput({ value, onChange, placeholder = '••••••', autoComplete = 'current-password', minLength }) {
  return (
    <div className="relative">
      <input
        type="password"
        value={value}
        onChange={onChange}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="input pr-12"
        placeholder={placeholder}
        id={`pw-${autoComplete}`}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center muted"
        onClick={(e) => {
          const input = e.currentTarget.previousSibling;
          input.type = input.type === 'password' ? 'text' : 'password';
          e.currentTarget.textContent = input.type === 'password' ? '👁' : '🙈';
        }}
        aria-label={t("Parolni ko'rsatish")}
      >
        👁
      </button>
    </div>
  );
}
