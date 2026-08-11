import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState({});
  const [booting, setBooting] = useState(true);
  const saveTimer = useRef(null);

  // Supabase sessiyasi (sessionStorage'da) o'zgarganda profil + progressni yuklaymiz.
  useEffect(() => {
    let cancelled = false;

    async function loadForSession(session) {
      if (!session) {
        if (!cancelled) {
          setUser(null);
          setProgress({});
        }
        return;
      }
      try {
        const { user: profile } = await api.me();
        const prog = await api.getProgress();
        if (!cancelled) {
          setUser(profile);
          setProgress(prog.state || {});
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setProgress({});
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadForSession(session).finally(() => !cancelled && setBooting(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadForSession(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login({ username, password });
    setUser(res.user);
    const prog = await api.getProgress();
    setProgress(prog.state || {});
    return res.user;
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const res = await api.register({ username, password, displayName });
    setUser(res.user);
    setProgress({});
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setProgress({});
  }, []);

  // Progressni debounce bilan Supabase'ga saqlash
  const updateProgress = useCallback((updater) => {
    setProgress((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        api.putProgress(next).catch(() => {});
      }, 500);
      return next;
    });
  }, []);

  const value = { user, progress, updateProgress, login, register, logout, booting };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return ctx;
}
