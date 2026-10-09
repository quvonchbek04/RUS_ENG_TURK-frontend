import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api.js';

const LAST_LANG_KEY = 'til_last_lang';

/** Joriy til: URL'dan (/lang/en/...) yoki oxirgi tanlangan tildan; standart — ingliz tili. */
export function useCurrentLang() {
  const { pathname } = useLocation();
  const m = pathname.match(/^\/lang\/(en|ru|tr)(\/|$)/);
  const fromPath = m ? m[1] : null;
  useEffect(() => {
    if (fromPath) {
      try {
        localStorage.setItem(LAST_LANG_KEY, fromPath);
      } catch {
        /* e'tiborsiz */
      }
    }
  }, [fromPath]);
  if (fromPath) return fromPath;
  try {
    const saved = localStorage.getItem(LAST_LANG_KEY);
    if (saved && ['en', 'ru', 'tr'].includes(saved)) return saved;
  } catch {
    /* e'tiborsiz */
  }
  return 'en';
}

export function useTheme() {
  const [theme, setTheme] = useState(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next = cur === 'dark' ? 'light' : 'dark';
      if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      try {
        localStorage.setItem('til_theme', next);
      } catch {
        /* e'tiborsiz */
      }
      return next;
    });
  }, []);
  return [theme, toggle];
}

/** Til kontentini yuklash uchun umumiy hook. */
export function useContent(lang) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api
      .content(lang)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [lang]);
  return { data, error };
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setMatches(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return matches;
}
