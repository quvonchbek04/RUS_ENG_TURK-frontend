import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState({});
  const [booting, setBooting] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | error
  const saveTimer = useRef(null);
  const pendingRef = useRef(null);

  // Faqat lokal ishlab chiqishda (npm run dev) va Supabase sozlanmagan bo'lsa — dizaynni
  // ko'rib chiqish uchun demo foydalanuvchi. Production build'ga bu kod kirmaydi.
  const demo = import.meta.env.DEV && !isSupabaseConfigured && !/[?&]nodemo/.test(window.location.search);

  useEffect(() => {
    if (!demo) return;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem('til_demo_progress') || '{}');
    } catch {
      /* e'tiborsiz */
    }
    // ?role=admin — oddiy admin ko'rinishini tekshirish uchun (faqat dev demo rejimida);
    // ?kinds=news,audio — shu admin faqat shu turlarni yuklay oladi (bo'lmasa — hammasi);
    // ?perms=users_view,ai_view — shu admin faqat shu funksiya ruxsatlariga ega (bo'lmasa — ko'rish ruxsatlari)
    const q = new URLSearchParams(window.location.search);
    const role = q.get('role') === 'admin' ? 'admin' : 'superadmin';
    const uploadKinds = q.has('kinds') ? q.get('kinds').split(',').filter(Boolean) : ['audio', 'video', 'image', 'text', 'dialog', 'vocab', 'news'];
    const permissions = q.has('perms') ? q.get('perms').split(',').filter(Boolean) : ['ai_view', 'mail_view', 'stats_view'];
    setUser({ id: 'demo', username: 'demo', displayName: 'Demo foydalanuvchi', role, uploadKinds, permissions, createdAt: new Date().toISOString() });
    setProgress(saved);
    setBooting(false);
  }, [demo]);

  useEffect(() => {
    if (demo) return undefined;
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
        if (profile?.isBlocked) {
          await supabase.auth.signOut();
          if (!cancelled) setUser(null);
          return;
        }
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

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Supabase callback ichida boshqa supabase so'rovini kutish tavsiya etilmaydi — keyingi tikka qoldiramiz
        setTimeout(() => loadForSession(session), 0);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [demo]);

  const login = useCallback(async (identifier, password, remember = true) => {
    const res = await api.login({ identifier, password, remember });
    setUser(res.user);
    const prog = await api.getProgress();
    setProgress(prog.state || {});
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.register(payload);
    if (res.user) {
      setUser(res.user);
      setProgress({});
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    if (pendingRef.current) {
      clearTimeout(saveTimer.current);
      await api.putProgress(pendingRef.current).catch(() => {});
      pendingRef.current = null;
    }
    await api.logout();
    setUser(null);
    setProgress({});
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: profile } = await api.me();
    setUser(profile);
    return profile;
  }, []);

  // Progressni debounce bilan Supabase'ga saqlash (sahifa yopilganda ham yo'qolmasligi uchun flush)
  const updateProgress = useCallback((updater) => {
    setProgress((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingRef.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const toSave = pendingRef.current;
        pendingRef.current = null;
        if (import.meta.env.DEV && !isSupabaseConfigured) {
          localStorage.setItem('til_demo_progress', JSON.stringify(toSave));
          return;
        }
        setSaveState('saving');
        api
          .putProgress(toSave)
          .then(() => setSaveState('idle'))
          .catch(() => setSaveState('error'));
      }, 700);
      return next;
    });
  }, []);

  useEffect(() => {
    const flush = () => {
      if (pendingRef.current) {
        api.putProgress(pendingRef.current).catch(() => {});
        pendingRef.current = null;
      }
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const value = {
    user,
    setUser,
    progress,
    updateProgress,
    login,
    register,
    logout,
    refreshUser,
    booting,
    recovery,
    clearRecovery: () => setRecovery(false),
    saveState,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return ctx;
}
