import { useEffect, useMemo, useRef, useState } from 'react';
import SpeakButton from './SpeakButton.jsx';
import { readingHint } from '../lib/translit.js';
import { getSpeechRecognition, langToBCP47, speakSequence, speakWithEnd } from '../lib/tts.js';
import { normalizeAnswer, shuffle } from '../lib/practice.js';
import { withActivity } from '../lib/lessonProgress.js';
import { useAuth } from '../context/AuthContext.jsx';
import { t } from '../i18n/index.js';

function SectionTitle({ icon, children, hint }) {
  return (
    <div className="flex items-center gap-2 mt-7 mb-3">
      <span className="text-lg">{icon}</span>
      <h4 className="font-display text-[17px] font-semibold flex-1" style={{ color: 'var(--ink)' }}>
        {children}
      </h4>
      {hint && <span className="badge badge-gold">{hint}</span>}
    </div>
  );
}

/** Qo'shimcha grammatika izohlari */
export function GrammarMore({ items }) {
  if (!items?.length) return null;
  return (
    <div>
      <SectionTitle icon="📘" hint={t('Kengaytma')}>
        {t("Qo'shimcha grammatika")}
      </SectionTitle>
      <div className="space-y-3">
        {items.map((g, i) => (
          <div key={i} className="card p-4">
            <div className="font-display font-semibold mb-1.5" style={{ color: 'var(--pine)' }}>
              {i + 1}. {g.title}
            </div>
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink)' }}>
              {g.text}
            </p>
            <div className="space-y-1.5">
              {g.examples?.map((ex, k) => (
                <div key={k} className="text-sm flex flex-wrap gap-x-3 gap-y-0.5 items-baseline rounded-lg px-3 py-2" style={{ background: 'var(--panel-2)' }}>
                  <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                    {ex[0]}
                  </span>
                  <span className="muted">{ex[1]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Aytilgan gap bilan asl gapning so'zma-so'z mosligi (0–100). */
function speechScore(target, said, lang) {
  const tok = (s) => normalizeAnswer(s, lang).split(' ').filter(Boolean);
  const want = tok(target);
  const pool = tok(said);
  if (!want.length) return 0;
  let hit = 0;
  for (const w of want) {
    const i = pool.indexOf(w);
    if (i >= 0) {
      hit += 1;
      pool.splice(i, 1);
    }
  }
  return Math.round((hit / want.length) * 100);
}

/** 🎭 Rolli o'qish: o'quvchi bitta rolni o'ynaydi — ilova qolgan gaplarni o'qiydi,
 *  o'quvchi o'z gapini mikrofonga aytadi va talaffuzi baholanadi. */
function RolePlay({ lines, lang, showTr, onExit }) {
  const { progress, updateProgress } = useAuth();
  const voice = progress.voiceSettings?.[lang] || {};
  const speakers = [...new Set(lines.map((l) => l[0]))];
  const [role, setRole] = useState(null);
  const [step, setStep] = useState(-1);
  const [scores, setScores] = useState({});
  const [heard, setHeard] = useState({});
  const [listening, setListening] = useState(false);
  const stopRef = useRef(null);
  const recRef = useRef(null);
  const SpeechRec = getSpeechRecognition();
  const finished = step >= lines.length;

  useEffect(
    () => () => {
      stopRef.current?.();
      recRef.current?.abort?.();
    },
    []
  );

  // Suhbatdoshning gapi — avtomatik o'qiladi va keyingisiga o'tiladi
  useEffect(() => {
    if (step < 0 || finished) return;
    const [speaker, text] = lines[step];
    if (speaker === role) return;
    stopRef.current = speakWithEnd(text, lang, { rate: voice.rate ?? 0.9, voiceURI: voice.voiceURI }, () => setTimeout(() => setStep((s) => s + 1), 350));
    return () => stopRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, role]);

  useEffect(() => {
    if (!finished || !role) return;
    const mine = Object.values(scores);
    if (!mine.length) return;
    const avg = Math.round(mine.reduce((a, b) => a + b, 0) / mine.length);
    updateProgress((prev) => withActivity(prev, Math.max(2, Math.round(avg / 10))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function listen() {
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = langToBCP47(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      const alts = Array.from(e.results?.[0] || []).map((a) => a.transcript);
      const best = alts.reduce(
        (acc, a) => {
          const sc = speechScore(lines[step][1], a, lang);
          return sc > acc.sc ? { sc, a } : acc;
        },
        { sc: -1, a: alts[0] || '' }
      );
      setHeard((h) => ({ ...h, [step]: best.a }));
      setScores((s) => ({ ...s, [step]: Math.max(0, best.sc) }));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function restart(newRole = role) {
    stopRef.current?.();
    setRole(newRole);
    setScores({});
    setHeard({});
    setStep(newRole ? 0 : -1);
  }

  if (!role) {
    return (
      <div className="card-soft p-4">
        <div className="font-bold mb-1" style={{ color: 'var(--ink)' }}>
          {t("🎭 Rolli o'qish")}
        </div>
        <p className="text-sm muted mb-3">
          {SpeechRec
            ? t("Rolni tanlang. Ilova suhbatdoshning gaplarini o'qiydi, siz o'z gaplaringizni mikrofonga ayting — talaffuzingiz baholanadi.")
            : t("Rolni tanlang. Ilova suhbatdoshning gaplarini o'qiydi, siz o'z gaplaringizni ovoz chiqarib o'qing.")}
        </p>
        <div className="flex flex-wrap gap-2">
          {speakers.map((s) => (
            <button key={s} type="button" className="btn btn-primary btn-sm" onClick={() => restart(s)}>
              {t('Men — {name}', { name: s })}
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
            {t('Bekor qilish')}
          </button>
        </div>
      </div>
    );
  }

  const mineScores = Object.values(scores);
  const avg = mineScores.length ? Math.round(mineScores.reduce((a, b) => a + b, 0) / mineScores.length) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="badge badge-gold">{t('🎭 Sizning rolingiz: {name}', { name: role })}</span>
        {avg != null && <span className={`badge ${avg >= 70 ? 'badge-pine' : 'badge-brick'}`}>{t("O'rtacha: {n}%", { n: avg })}</span>}
        <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => restart(role)}>
          {t('↺ Boshidan')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            stopRef.current?.();
            onExit();
          }}
        >
          {t('✕ Chiqish')}
        </button>
      </div>
      <div className="space-y-2.5">
        {lines.map(([speaker, line, tr], i) => {
          const mine = speaker === role;
          const visible = i <= step;
          const current = i === step && !finished;
          const sc = scores[i];
          if (!visible) return null;
          return (
            <div key={i} className={`flex gap-2 items-end ${mine ? 'flex-row-reverse' : ''} anim-rise`}>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}>
                {speaker}
              </span>
              <div
                className="rounded-2xl px-4 py-2.5 max-w-[85%] border"
                style={{
                  background: mine ? 'var(--pine)' : 'var(--panel)',
                  color: mine ? '#fff' : 'var(--ink)',
                  borderColor: current ? 'var(--gold)' : mine ? 'var(--pine)' : 'var(--line)',
                  boxShadow: current ? '0 0 0 3px var(--gold-soft)' : 'none',
                }}
              >
                <div className="text-[15px]">{line}</div>
                {readingHint(line, lang) && <div className="text-[11px] mt-0.5 opacity-70 font-mono">{readingHint(line, lang)}</div>}
                {showTr && tr && <div className="text-xs mt-1 opacity-80">{tr}</div>}
                {mine && heard[i] !== undefined && (
                  <div className="text-xs mt-1.5 pt-1.5 border-t" style={{ borderColor: 'rgba(255,255,255,.25)' }}>
                    🎙 «{heard[i] || '…'}» — <b>{sc}%</b> {sc >= 85 ? t("a'lo!") : sc >= 60 ? t('yaxshi') : t("yana urinib ko'ring")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!finished && step >= 0 && lines[step][0] === role && (
        <div className="flex flex-wrap gap-2 mt-4">
          {SpeechRec && (
            <button type="button" className={`btn ${listening ? 'btn-danger' : 'btn-brand'}`} onClick={listen} disabled={listening}>
              {listening ? <><span className="spinner" /> {t('Tinglayapman…')}</> : scores[step] !== undefined ? t('🎙 Qayta aytish') : t('🎙 Gapingizni ayting')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => speakWithEnd(lines[step][1], lang, { rate: voice.rate ?? 0.9, voiceURI: voice.voiceURI })}>
            {t('🔊 Namuna')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={listening}>
            {SpeechRec && scores[step] === undefined ? t("O'tkazib yuborish →") : t('Keyingisi →')}
          </button>
        </div>
      )}
      {!finished && step >= 0 && lines[step][0] !== role && (
        <div className="text-sm muted mt-4 flex items-center gap-2">
          <span className="spinner" /> {t('{name} gapirmoqda…', { name: lines[step][0] })}
        </div>
      )}
      {finished && (
        <div className="alert alert-success mt-4">
          {t('🎉 Dialog tugadi!')}
          {avg != null ? ` ${t("O'rtacha talaffuz: {n}%.", { n: avg })}` : ''}{' '}
          <button type="button" className="underline font-bold" onClick={() => restart(speakers.find((s) => s !== role) || role)}>
            {t("Boshqa rolda o'qish")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Dialog — chat ko'rinishida, butun dialogni ketma-ket ovoz bilan tinglash va rolli o'qish imkoni bilan. */
export function DialogView({ title, lines, lang, hint, audioUrl, defaultShowTr = true }) {
  const { progress } = useAuth();
  const voice = progress.voiceSettings?.[lang] || {};
  const [showTr, setShowTr] = useState(defaultShowTr);
  const [playing, setPlaying] = useState(-1);
  const [rolePlay, setRolePlay] = useState(false);
  const stopRef = useRef(null);

  useEffect(() => () => stopRef.current?.(), []);

  if (!lines?.length) return null;
  const speakers = [...new Set(lines.map((l) => l[0]))];

  if (rolePlay) {
    return (
      <div>
        {title && (
          <SectionTitle icon="💬" hint={hint}>
            {title}
          </SectionTitle>
        )}
        <label className="flex items-center gap-2 text-xs muted cursor-pointer select-none mb-3">
          <input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
          {t("Tarjimani ko'rsatish")}
        </label>
        <RolePlay lines={lines} lang={lang} showTr={showTr} onExit={() => setRolePlay(false)} />
      </div>
    );
  }

  function playAll() {
    if (playing >= 0) {
      stopRef.current?.();
      setPlaying(-1);
      return;
    }
    stopRef.current = speakSequence(
      lines.map((l) => l[1]),
      lang,
      { rate: voice.rate ?? 0.9, voiceURI: voice.voiceURI, onLine: setPlaying, onEnd: () => setPlaying(-1) }
    );
  }

  return (
    <div>
      {title && (
        <SectionTitle icon="💬" hint={hint}>
          {title}
        </SectionTitle>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button type="button" onClick={playAll} className={`btn btn-sm ${playing >= 0 ? 'btn-danger' : 'btn-soft'}`}>
          {playing >= 0 ? t("⏹ To'xtatish") : t('▶ Butun dialogni tinglash')}
        </button>
        {speakers.length >= 2 && (
          <button
            type="button"
            className="btn btn-sm btn-gold"
            onClick={() => {
              stopRef.current?.();
              setPlaying(-1);
              setRolePlay(true);
            }}
          >
            {t("🎭 Rolli o'qish")}
          </button>
        )}
        <label className="flex items-center gap-2 text-xs muted cursor-pointer select-none ml-auto">
          <input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
          {t("Tarjimani ko'rsatish")}
        </label>
      </div>
      {audioUrl && <audio controls preload="none" src={audioUrl} className="w-full mb-3" />}
      <div className="space-y-2.5">
        {lines.map(([speaker, line, tr], i) => {
          const right = speakers.indexOf(speaker) % 2 === 1;
          const active = playing === i;
          return (
            <div key={i} className={`flex gap-2 items-end ${right ? 'flex-row-reverse' : ''}`}>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: 'var(--paper-soft)', color: 'var(--ink-soft)' }}>
                {speaker}
              </span>
              <div
                className="rounded-2xl px-4 py-2.5 max-w-[82%] border transition-shadow"
                style={{
                  background: right ? 'var(--pine)' : 'var(--panel)',
                  color: right ? '#fff' : 'var(--ink)',
                  borderColor: active ? 'var(--gold)' : right ? 'var(--pine)' : 'var(--line)',
                  boxShadow: active ? '0 0 0 3px var(--gold-soft)' : 'none',
                }}
              >
                <div className="text-[15px]">{line}</div>
                {lang === 'ru' && readingHint(line, lang) && showTr && <div className="text-[11px] mt-0.5 opacity-70 font-mono">{readingHint(line, lang)}</div>}
                {showTr && tr && <div className="text-xs mt-1 opacity-80">{tr}</div>}
              </div>
              <SpeakButton text={line} lang={lang} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ikkinchi dialog (ingliz tili darslarida) */
export function DialogExtra({ dialog, lang }) {
  if (!dialog?.lines?.length) return null;
  return <DialogView title={dialog.title} lines={dialog.lines} lang={lang} hint={t('2-dialog')} />;
}

/** O'qish matni + savollar */
export function ReadingBlock({ reading, lang }) {
  const [showTr, setShowTr] = useState(false);
  const [open, setOpen] = useState({});
  if (!reading) return null;
  return (
    <div>
      <SectionTitle icon="📖" hint={t("O'qish")}>
        {reading.title}
      </SectionTitle>
      <div className="card p-4">
        <div className="flex gap-3 items-start">
          <p className="flex-1 leading-relaxed text-[15px]" style={{ color: 'var(--ink)' }}>
            {reading.text}
          </p>
          <SpeakButton text={reading.text} lang={lang} />
        </div>
        <button type="button" onClick={() => setShowTr((v) => !v)} className="mt-3 text-xs font-bold" style={{ color: 'var(--gold)' }}>
          {showTr ? t('▾ Tarjimani yashirish') : t("▸ Tarjimani ko'rsatish")}
        </button>
        {showTr && (
          <p className="mt-2 text-sm leading-relaxed rounded-lg p-3" style={{ background: 'var(--panel-2)', color: 'var(--ink-soft)' }}>
            {reading.uz}
          </p>
        )}
      </div>
      {reading.questions?.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider muted">{t('Tushunish savollari')}</div>
          {reading.questions.map(([q, a], i) => (
            <div key={i} className="card-soft p-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {i + 1}. {q}
              </div>
              {open[i] ? (
                <div className="text-sm mt-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'var(--success-bg)', color: 'var(--ink)' }}>
                  ✅ {a}
                </div>
              ) : (
                <button type="button" className="text-xs font-bold mt-1.5" style={{ color: 'var(--pine)' }} onClick={() => setOpen((o) => ({ ...o, [i]: true }))}>
                  {t("Javobni ko'rish")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kengaytirilgan so'zlar va iboralar (Word fayldan): qidiruv, tarjimani yashirish, talaffuz */
export function WordsExplorer({ words = [], phrases = [], lang, wordCats = [], phraseCats = [] }) {
  const [tab, setTab] = useState(words.length ? 'words' : 'phrases');
  const [q, setQ] = useState('');
  const [hide, setHide] = useState(false);
  const [limit, setLimit] = useState(20);

  const list = tab === 'words' ? words : phrases;
  const cats = tab === 'words' ? wordCats : phraseCats;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) => String(r[0]).toLowerCase().includes(s) || String(r[1]).toLowerCase().includes(s));
  }, [list, q]);

  if (!words.length && !phrases.length) return null;

  return (
    <div>
      <SectionTitle icon="🗂️" hint={t('Word fayldan')}>
        {t("Gaplar bilan so'zlar va iboralar")}
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {words.length > 0 && (
          <button
            type="button"
            className={`chip ${tab === 'words' ? 'chip-active' : ''}`}
            onClick={() => {
              setTab('words');
              setLimit(20);
            }}
          >
            {t("So'zlar · {n}", { n: words.length })}
          </button>
        )}
        {phrases.length > 0 && (
          <button
            type="button"
            className={`chip ${tab === 'phrases' ? 'chip-active' : ''}`}
            onClick={() => {
              setTab('phrases');
              setLimit(20);
            }}
          >
            {t('Iboralar · {n}', { n: phrases.length })}
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs muted cursor-pointer select-none">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} style={{ accentColor: 'var(--pine)' }} />
          {t('Tarjimani yashirish')}
        </label>
      </div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(20);
        }}
        placeholder={t('🔍 Qidirish…')}
        className="input mb-3"
      />
      <div className="space-y-2">
        {filtered.slice(0, limit).map(([w, tr, sent, sentTr, cat], i) => {
          const hint = readingHint(w, lang);
          return (
            <div key={w + i} className="card-soft p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-display font-semibold text-[17px]" style={{ color: 'var(--ink)' }}>
                      {w}
                    </span>
                    {hint && <span className="font-mono text-xs faint">{hint}</span>}
                    <span
                      className="text-sm font-semibold transition-all cursor-pointer"
                      style={{ color: 'var(--gold)', filter: hide ? 'blur(6px)' : 'none' }}
                      onClick={(e) => (e.currentTarget.style.filter = 'none')}
                    >
                      {tr}
                    </span>
                  </div>
                  {sent && (
                    <div className="text-sm mt-1.5 italic" style={{ color: 'var(--ink)' }}>
                      {sent}
                    </div>
                  )}
                  {sentTr && (
                    <div className="text-xs mt-0.5 muted cursor-pointer" style={{ filter: hide ? 'blur(5px)' : 'none' }} onClick={(e) => (e.currentTarget.style.filter = 'none')}>
                      {sentTr}
                    </div>
                  )}
                  {cats[cat] && <div className="text-[10.5px] faint mt-1">{t(cats[cat])}</div>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <SpeakButton text={w} lang={lang} title={t("So'zni eshitish")} />
                  {sent && <SpeakButton text={sent} lang={lang} title={t('Gapni eshitish')} />}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-sm text-center py-6 muted">{t('Hech narsa topilmadi.')}</div>}
      </div>
      {filtered.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 30)} className="btn btn-ghost btn-block mt-3">
          {t("Yana ko'rsatish ({n} ta qoldi)", { n: filtered.length - limit })}
        </button>
      )}
    </div>
  );
}

/** Aylanuvchi kartochkalar: so'z → ma'no. */
export function Flashcards({ items, lang }) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState({});
  const touchX = useRef(null);
  if (!items.length) return null;
  const it = items[order[pos]];
  const hint = readingHint(it.w, lang) || it.t;
  const go = (d) => {
    setFlipped(false);
    setPos((p) => (p + d + order.length) % order.length);
  };
  const knownCount = Object.values(known).filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="muted">
          {pos + 1} / {order.length}
        </span>
        <span className="badge badge-pine">{t('Bilaman: {n}', { n: knownCount })}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm ml-auto"
          onClick={() => {
            setOrder(shuffle(order));
            setPos(0);
            setFlipped(false);
          }}
        >
          {t('🔀 Aralashtirish')}
        </button>
      </div>
      <div
        className={`flip cursor-pointer select-none ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped((v) => !v)}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) {
            e.preventDefault();
            go(dx < 0 ? 1 : -1);
          }
        }}
      >
        <div className="flip-inner">
          <div className="flip-face">
            <div className="font-display text-3xl font-semibold break-words" style={{ color: 'var(--ink)' }}>
              {it.w}
            </div>
            {hint && hint !== it.w && (
              <div className="font-mono text-sm mt-1" style={{ color: 'var(--gold)' }}>
                {hint}
              </div>
            )}
            <div className="mt-4" onClick={(e) => e.stopPropagation()}>
              <SpeakButton text={it.w} lang={lang} size="lg" />
            </div>
            <div className="text-xs faint mt-4">{t("Ma'nosini ko'rish uchun bosing")}</div>
          </div>
          <div className="flip-face flip-back">
            <div className="font-display text-2xl font-semibold" style={{ color: 'var(--pine)' }}>
              {it.m}
            </div>
            {it.s && (
              <div className="text-sm italic mt-3" style={{ color: 'var(--ink)' }}>
                {it.s}
              </div>
            )}
            {it.st && <div className="text-xs muted mt-1">{it.st}</div>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        <button type="button" className="btn btn-ghost" onClick={() => go(-1)}>
          ←
        </button>
        <button
          type="button"
          className="btn btn-danger col-span-1"
          onClick={() => {
            setKnown((k) => ({ ...k, [order[pos]]: false }));
            go(1);
          }}
        >
          ✗ <span className="hidden sm:inline">{t('Bilmayman')}</span>
        </button>
        <button
          type="button"
          className="btn btn-soft col-span-1"
          onClick={() => {
            setKnown((k) => ({ ...k, [order[pos]]: true }));
            go(1);
          }}
        >
          ✓ <span className="hidden sm:inline">{t('Bilaman')}</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go(1)}>
          →
        </button>
      </div>
    </div>
  );
}
