import { useCallback, useEffect, useRef, useState } from 'react';
import SpeakButton from './SpeakButton.jsx';
import { ProgressBar } from './ui.jsx';
import { buildQuestions, checkAnswer, expectedAnswer, MODES } from '../lib/practice.js';
import { readingHint } from '../lib/translit.js';
import { speakSimple } from '../lib/tts.js';
import { useAuth } from '../context/AuthContext.jsx';
import { t } from '../i18n/index.js';

const cut = (s, n = 140) => (s ? String(s).slice(0, n) : undefined);

/**
 * Lug'at mashqi sessiyasi. Istalgan payt "To'xtatish" bosilsa — sessiya yakunlanadi va
 * onFinish(record) chaqiriladi (natija sahifasida xatolar alohida ko'rsatiladi).
 *
 * props: items, pool, lang, mode, count, title, source, label, strict (javob berilmaganlar
 *        ham umumiy songa kiradi — dars testi uchun), onFinish(record), onExit()
 */
export default function PracticeSession({ items, pool, lang, mode = 'choice', count = 20, title, source, label, strict = false, onFinish, onExit, extra = {} }) {
  const { progress } = useAuth();
  const voice = progress.voiceSettings?.[lang] || {};
  // Savollar sessiya boshlanganda bir marta tuziladi (qayta boshlash uchun komponentga yangi `key` bering)
  const [questions] = useState(() => buildQuestions(items, { mode, count, pool }));
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [typed, setTyped] = useState('');
  const [autoNext, setAutoNext] = useState(() => {
    try {
      return localStorage.getItem('til_auto_next') !== '0';
    } catch {
      return true;
    }
  });
  const startedAt = useRef(Date.now());
  const finishedRef = useRef(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const q = questions[idx];
  const current = answers[idx];
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.ok).length;
  const wrongCount = answeredCount - correctCount;

  const finish = useCallback(
    (early) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimeout(timerRef.current);
      window.speechSynthesis?.cancel?.();
      const mistakes = [];
      const skipped = [];
      const okList = [];
      questions.forEach((qq, i) => {
        const a = answers[i];
        const base = { w: qq.item.w, t: cut(qq.item.t, 60) || '', m: qq.item.m };
        if (!a) skipped.push(base);
        else if (!a.ok) mistakes.push({ ...base, g: a.given ?? '', qm: qq.mode, s: cut(qq.item.s), st: cut(qq.item.st) });
        else okList.push([qq.item.w, qq.item.m]);
      });
      const record = {
        id: Date.now().toString(36),
        lang,
        at: Date.now(),
        source,
        label: label || title,
        mode,
        total: strict ? questions.length : answeredCount,
        planned: questions.length,
        answered: answeredCount,
        correct: correctCount,
        early: Boolean(early),
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
        mistakes: mistakes.slice(0, 120),
        skipped: skipped.slice(0, 120),
        okList: okList.slice(0, 120),
        ...extra,
      };
      onFinish?.(record);
    },
    [questions, answers, answeredCount, correctCount, lang, source, label, title, mode, strict, onFinish, extra]
  );

  const goNext = useCallback(() => {
    clearTimeout(timerRef.current);
    if (idx + 1 >= questions.length) {
      finish(false);
      return;
    }
    setIdx((i) => i + 1);
    setTyped('');
  }, [idx, questions.length, finish]);

  function submit(given) {
    if (current || !q) return;
    const res = checkAnswer(q, given, lang);
    setAnswers((a) => ({ ...a, [idx]: { given, ok: res.ok, typo: res.typo } }));
    if (q.mode !== 'listen' && q.mode !== 'choice') speakSimple(q.item.w, lang, { rate: voice.rate ?? 0.9, voiceURI: voice.voiceURI });
    if (res.ok && autoNext) timerRef.current = setTimeout(goNext, res.typo ? 1600 : 900);
  }

  function skip() {
    if (current) return goNext();
    setAnswers((a) => ({ ...a, [idx]: { given: '', ok: false, skipped: true } }));
  }

  // Tinglash savolida so'zni avtomatik o'qib beradi
  useEffect(() => {
    if (q?.mode === 'listen' && !current) {
      const timer = setTimeout(() => speakSimple(q.item.w, lang, { rate: voice.rate ?? 0.85, voiceURI: voice.voiceURI }), 250);
      return () => clearTimeout(timer);
    }
    if (q?.mode === 'write' && !current) setTimeout(() => inputRef.current?.focus(), 50);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, q?.mode]);

  // Klaviatura: 1-4 variant tanlash, Enter — keyingisi
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.key !== 'Enter')) return;
      if (current && e.key === 'Enter') {
        e.preventDefault();
        goNext();
        return;
      }
      if (!current && q?.options && /^[1-4]$/.test(e.key)) {
        const opt = q.options[Number(e.key) - 1];
        if (opt) submit(opt);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!questions.length) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-2">🫙</div>
        <div className="h2 mb-1">{t("So'z topilmadi")}</div>
        <p className="muted text-sm">{t("Tanlangan manbada mashq uchun so'zlar yo'q.")}</p>
        {onExit && (
          <button type="button" className="btn btn-primary mt-4" onClick={onExit}>
            {t('Orqaga')}
          </button>
        )}
      </div>
    );
  }

  const hint = readingHint(q.item.w, lang) || q.item.t;
  const promptWord = q.mode === 'choice' || (q.mode === 'listen' && current);
  const expected = expectedAnswer(q);

  return (
    <div>
      {/* Yuqori panel */}
      <div className="flex items-center gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider muted truncate">
            {MODES[q.mode]?.icon} {t(title)}
          </div>
          <div className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
            {idx + 1} / {questions.length}
          </div>
        </div>
        <span className="badge badge-pine">✓ {correctCount}</span>
        <span className="badge badge-brick">✗ {wrongCount}</span>
        <button type="button" onClick={() => finish(true)} className="btn btn-danger btn-sm" title={t("Mashqni shu yerda tugatib, natijani ko'rish")}>
          {t("⏹ To'xtatish")}
        </button>
      </div>
      <ProgressBar value={((idx + (current ? 1 : 0)) / questions.length) * 100} className="mb-6" />

      {/* Savol kartasi */}
      <div className="ticket-edge card p-6 sm:p-8 text-center mb-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] muted mb-3">{MODES[q.mode]?.hint}</div>

        {promptWord && (
          <>
            <div className="font-display text-3xl sm:text-4xl font-semibold mb-1 break-words" style={{ color: 'var(--ink)' }}>
              {q.item.w}
            </div>
            {hint && hint !== q.item.w && (
              <div className="font-mono text-sm mb-3" style={{ color: 'var(--gold)' }}>
                {hint}
              </div>
            )}
            <SpeakButton text={q.item.w} lang={lang} size="lg" className="mx-auto mt-2" />
          </>
        )}

        {q.mode === 'listen' && !current && (
          <button
            type="button"
            onClick={() => speakSimple(q.item.w, lang, { rate: voice.rate ?? 0.85, voiceURI: voice.voiceURI })}
            className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl btn-brand"
            title={t('Yana eshitish')}
          >
            🔊
          </button>
        )}

        {(q.mode === 'reverse' || q.mode === 'write') && (
          <>
            <div className="font-display text-2xl sm:text-3xl font-semibold break-words" style={{ color: 'var(--ink)' }}>
              {q.item.m}
            </div>
            {q.mode === 'write' && !current && (
              <div className="text-xs muted mt-2">
                {t('Birinchi harf:')} <b className="font-mono">{String(q.item.w).trim()[0]}</b> · {t('{n} ta belgi', { n: String(q.item.w).trim().length })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Javob variantlari */}
      {q.options && (
        <div className="grid gap-2.5">
          {q.options.map((opt, i) => {
            const isSel = current?.given === opt;
            const isRight = opt === expected;
            let style = { borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' };
            if (current) {
              if (isRight) style = { borderColor: 'var(--pine)', background: 'var(--pine)', color: '#fff' };
              else if (isSel) style = { borderColor: 'var(--brick)', background: 'var(--error-bg)', color: 'var(--brick)' };
              else style = { ...style, opacity: 0.6 };
            }
            return (
              <button
                key={i}
                type="button"
                disabled={!!current}
                onClick={() => submit(opt)}
                className="text-left px-4 py-3.5 rounded-2xl border-2 transition-colors cursor-pointer flex items-center gap-3 disabled:cursor-default"
                style={style}
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'color-mix(in srgb, currentColor 12%, transparent)' }}>
                  {i + 1}
                </span>
                <span className="flex-1 font-semibold">{opt}</span>
                {q.mode === 'reverse' && <SpeakButton text={opt} lang={lang} />}
              </button>
            );
          })}
        </div>
      )}

      {q.mode === 'write' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (current) goNext();
            else if (typed.trim()) submit(typed);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!!current}
            placeholder={t("So'zni yozing…")}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            lang={lang}
            className="input text-lg"
            style={current ? { borderColor: current.ok ? 'var(--pine)' : 'var(--brick)' } : undefined}
          />
          {!current && (
            <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>
              {t('Tekshirish')}
            </button>
          )}
        </form>
      )}

      {/* Javobdan keyingi izoh */}
      {current && (
        <div className="mt-4 rounded-2xl p-4 anim-rise" style={{ background: current.ok ? 'var(--success-bg)' : 'var(--error-bg)' }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{current.ok ? '✅' : current.skipped ? '⏭️' : '❌'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ color: current.ok ? 'var(--pine)' : 'var(--brick)' }}>
                {current.ok ? (current.typo ? t("To'g'ri (kichik imlo xatosi bor)") : t("To'g'ri!")) : current.skipped ? t("O'tkazib yuborildi") : t("Noto'g'ri")}
              </div>
              {(!current.ok || current.typo || q.mode === 'listen') && (
                <div className="text-sm mt-0.5" style={{ color: 'var(--ink)' }}>
                  {t("To'g'ri javob:")} <b>{expected}</b>
                  {q.mode !== 'choice' && q.mode !== 'listen' && <> — {q.item.m}</>}
                  {q.mode === 'listen' && <> ({q.item.w})</>}
                </div>
              )}
              {q.item.s && (
                <div className="text-sm mt-2 italic" style={{ color: 'var(--ink)' }}>
                  {q.item.s}
                  {q.item.st && <div className="not-italic muted text-xs mt-0.5">{q.item.st}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {current ? (
          <button type="button" onClick={goNext} className="btn btn-primary btn-lg flex-1">
            {idx + 1 >= questions.length ? t("Natijani ko'rish") : t('Keyingisi →')}
          </button>
        ) : (
          <button type="button" onClick={skip} className="btn btn-ghost">
            {t("⏭ O'tkazib yuborish")}
          </button>
        )}
        <label className="flex items-center gap-2 text-xs muted ml-auto cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoNext}
            onChange={(e) => {
              setAutoNext(e.target.checked);
              try {
                localStorage.setItem('til_auto_next', e.target.checked ? '1' : '0');
              } catch {
                /* e'tiborsiz */
              }
            }}
            style={{ accentColor: 'var(--pine)' }}
          />
          {t("To'g'ri bo'lsa avtomatik keyingisi")}
        </label>
      </div>
      <p className="hidden lg:block text-[11px] faint mt-3">{t('Klaviatura: 1–4 — variant tanlash, Enter — keyingisi.')}</p>
    </div>
  );
}
