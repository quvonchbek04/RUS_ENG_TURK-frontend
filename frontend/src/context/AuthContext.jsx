import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState({});
  const [booting, setBooting] = useState(true);
  const saveTimer = useRef(null);
  const pendingProgress = useRef(null);
  const loadedUserId = useRef(null);

  /** Kutilayotgan (debounce ichidagi) progressni darhol saqlab yuboradi. */
  const flushProgress = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingProgress.current;
    pendingProgress.current = null;
    if (!pending) return;
    try {
      await api.putProgress(pending);
    } catch {
      /* saqlab bo'lmadi — keyingi o'zgarishda qayta urinadi */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadForSession(session) {
      if (!session) {
        loadedUserId.current = null;
        if (!cancelled) {
          setUser(null);
          setProgress({});
        }
        return;
      }
      // MUHIM: TOKEN_REFRESHED yoki oyna fokusga qaytgan paytdagi takroriy
      // hodisalarda profil va progressni QAYTA yuklamaymiz. Avval har bir
      // hodisada serverdan progress tortib olinar va hali saqlanmagan mahalliy
      // o'zgarishlar (masalan, hozirgina belgilangan dars bosqichi) ustiga
      // yozilib, yo'qolib ketardi.
      if (loadedUserId.current === session.user.id) return;
      loadedUserId.current = session.user.id;
      try {
        const { user: profile } = await api.me();
        const prog = await api.getProgress();
        if (!cancelled) {
          setUser(profile);
          setProgress(prog.state || {});
        }
      } catch {
        loadedUserId.current = null;
        if (!cancelled) {
          setUser(null);
          setProgress({});
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadForSession(session).finally(() => !cancelled && setBooting(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // MUHIM: onAuthStateChange callback'i ichida to'g'ridan-to'g'ri boshqa
      // `supabase.*` (yoki ularga tayanadigan `api.*`) chaqiruvlarini bajarish
      // Supabase klientida ichki qulf (deadlock) hosil qiladi — ilova "Yuklanmoqda…"
      // holatida abadiy osilib qolishi mumkin. Shuning uchun ishni keyingi
      // mikro-vazifaga (setTimeout 0) ko'chiramiz.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      setTimeout(() => {
        if (!cancelled) loadForSession(session);
      }, 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login({ username, password });
    loadedUserId.current = res.user.id;
    setUser(res.user);
    const prog = await api.getProgress();
    setProgress(prog.state || {});
    return res.user;
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const res = await api.register({ username, password, displayName });
    loadedUserId.current = res.user.id;
    setUser(res.user);
    setProgress({});
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    // Chiqishdan OLDIN saqlanmagan progressni yozib qo'yamiz — aks holda
    // oxirgi 0.5 soniyadagi o'zgarishlar yo'qolardi.
    await flushProgress();
    loadedUserId.current = null;
    await api.logout();
    setUser(null);
    setProgress({});
  }, [flushProgress]);

  // Progressni debounce bilan Supabase'ga saqlash
  const updateProgress = useCallback((updater) => {
    setProgress((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingProgress.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        const toSave = pendingProgress.current;
        pendingProgress.current = null;
        api.putProgress(toSave).catch(() => {});
      }, 500);
      return next;
    });
  }, []);

  // Varaq yopilayotganda yoki fon rejimiga o'tayotganda saqlanmagan progressni yuboramiz.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') flushProgress();
    }
    window.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushProgress);
    return () => {
      window.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushProgress);
    };
  }, [flushProgress]);

  const value = { user, progress, updateProgress, login, register, logout, booting };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return ctx;
}
