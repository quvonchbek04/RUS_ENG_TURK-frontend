import { createContext, Fragment, useCallback, useContext, useMemo, useState } from 'react';
import { UI_LANGS, getLang, setLang as applyLang, t } from './index.js';

const I18nContext = createContext({ lang: 'uz', setLang: () => {} });

/** Tilni saqlaydi va o'zgarganda bolalarini qayta chizadi (barcha t() chaqiruvlari yangi tilda ishlaydi). */
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getLang);
  const setLang = useCallback((key) => {
    applyLang(key);
    setLangState(key);
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Sahifalar qismini til o'zgarganda qayta yaratadi (key = til). Provayderlar (kirish, progress) saqlanib qoladi. */
export function LangBoundary({ children }) {
  const { lang } = useContext(I18nContext);
  return <Fragment key={lang}>{children}</Fragment>;
}

export function useLang() {
  return useContext(I18nContext);
}

/** Til tanlagich. variant: "chips" (kichik tugmalar qatori) | "select" (ochiladigan ro'yxat) | "cycle" (bitta tugma — keyingi tilga) */
export function LanguageSwitcher({ variant = 'chips', className = '' }) {
  const { lang, setLang } = useLang();
  if (variant === 'select') {
    return (
      <select className={`select ${className}`} value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('Sayt tili')}>
        {UI_LANGS.map((l) => (
          <option key={l.key} value={l.key}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    );
  }
  if (variant === 'cycle') {
    const i = UI_LANGS.findIndex((l) => l.key === lang);
    const next = UI_LANGS[(i + 1) % UI_LANGS.length];
    const cur = UI_LANGS[i] || UI_LANGS[0];
    return (
      <button type="button" className={`btn btn-ghost btn-icon ${className}`} onClick={() => setLang(next.key)} title={`${t('Sayt tili')}: ${cur.label}`} aria-label={t('Sayt tili')}>
        <span className="text-lg leading-none">{cur.flag}</span>
      </button>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`} role="group" aria-label={t('Sayt tili')}>
      {UI_LANGS.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => setLang(l.key)}
          aria-pressed={lang === l.key}
          title={l.label}
          className={`chip !px-2.5 !py-1 text-xs ${lang === l.key ? 'chip-active' : ''}`}
        >
          <span>{l.flag}</span> {l.key.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Matn ichidagi **qalin** qismlarni <b> ga aylantiradi (tarjima qilinadigan matnda teglar o'rniga). */
export function Rich({ text }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
