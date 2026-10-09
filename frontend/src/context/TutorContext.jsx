import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// AI ustoz paneli holati: ochiq/yopiq va hozirgi sahifaning konteksti
// (masalan, dars mavzusi va grammatika matni) — AI shu kontekstga tayanib javob beradi.
const TutorContext = createContext(null);

export function TutorProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(null); // { title, text, lang }
  const [draft, setDraft] = useState('');

  const ask = useCallback((text) => {
    setDraft(text || '');
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ open, setOpen, context, setContext, draft, setDraft, ask }), [open, context, draft, ask]);
  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}

export function useTutor() {
  const ctx = useContext(TutorContext);
  if (!ctx) throw new Error('useTutor TutorProvider ichida ishlatilishi kerak');
  return ctx;
}

/** Sahifa ochiq turganda AI ustozga kontekst beradi va sahifadan chiqilganda tozalaydi. */
export function useTutorContext(ctx) {
  const { setContext } = useTutor();
  const key = ctx ? `${ctx.lang}|${ctx.title}` : '';
  useEffect(() => {
    if (!ctx) return undefined;
    setContext(ctx);
    return () => setContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setContext]);
}
