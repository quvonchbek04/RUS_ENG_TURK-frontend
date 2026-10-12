import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWordTimings, getVoicesFor, hasVoiceFor, isSpeechSupported, speakChunks, stopSpeaking } from '../lib/tts.js';
import { useVoicesVersion } from '../lib/hooks.js';
import { t } from '../i18n/index.js';

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function buildWordSpansHtml(text) {
  const regex = /\S+/g;
  let html = '';
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    html += escapeHtml(text.slice(lastIndex, start));
    html += `<span class="tts-word" data-start="${start}" data-end="${end}">${escapeHtml(match[0])}</span>`;
    lastIndex = end;
  }
  html += escapeHtml(text.slice(lastIndex));
  return html;
}

export default function TtsReader({ text, lang, rate, voiceURI, onRateChange, onVoiceChange }) {
  const containerRef = useRef(null);
  const spansRef = useRef([]);
  const timingsRef = useRef([]);
  const totalMsRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const playStartTsRef = useRef(0);
  const rafRef = useRef(null);
  const playingRef = useRef(false);
  const stopRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const voicesVersion = useVoicesVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const voices = useMemo(() => getVoicesFor(lang), [lang, voicesVersion]);

  const html = useMemo(() => buildWordSpansHtml(text || ''), [text]);

  useEffect(() => {
    // Matn o'zgarsa — o'qishni to'xtatib, boshidan boshlaymiz
    stop();
    if (containerRef.current) {
      spansRef.current = Array.from(containerRef.current.querySelectorAll('.tts-word'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  useEffect(() => () => stop(), []); // unmountda tozalash

  function tick() {
    const elapsed = elapsedBeforePauseRef.current + (Date.now() - playStartTsRef.current);
    let current = null;
    spansRef.current.forEach((span, i) => {
      const tm = timingsRef.current[i];
      if (!tm) return;
      if (elapsed >= tm.end) {
        span.classList.add('read');
        span.classList.remove('current');
      } else if (elapsed >= tm.start) {
        span.classList.add('current');
        span.classList.remove('read');
        current = span;
      } else {
        span.classList.remove('read', 'current');
      }
    });
    if (current && current.scrollIntoView) {
      current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    // Ovoz o'qilayotgan ekan, taymer to'xtamaydi (har bir gap boshlanganda vaqt haqiqiy o'rnga moslab turiladi)
    if (playingRef.current) rafRef.current = requestAnimationFrame(tick);
  }

  /** Matndagi belgi indeksiga to'g'ri keladigan taxminiy vaqt (ms). */
  function timeAtChar(index) {
    for (let i = 0; i < spansRef.current.length; i++) {
      if (parseInt(spansRef.current[i].dataset.start, 10) >= index) return timingsRef.current[i]?.start ?? 0;
    }
    return totalMsRef.current;
  }

  /** O'tgan vaqtga to'g'ri keladigan matn belgisi indeksi (davom ettirish uchun). */
  function charAtElapsed(elapsedMs) {
    for (let i = 0; i < timingsRef.current.length; i++) {
      if (timingsRef.current[i].end > elapsedMs) return parseInt(spansRef.current[i].dataset.start, 10);
    }
    return text.length;
  }

  function halt() {
    playingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  function start(resume) {
    if (!isSpeechSupported()) {
      alert(t("Kechirasiz, bu brauzer ovozli o'qishni qo'llab-quvvatlamaydi."));
      return;
    }
    halt();

    if (!resume) {
      spansRef.current.forEach((s) => s.classList.remove('read', 'current'));
      const built = buildWordTimings(text, spansRef.current.map((s) => ({
        start: parseInt(s.dataset.start, 10),
        end: parseInt(s.dataset.end, 10),
      })), rate);
      timingsRef.current = built.timings;
      totalMsRef.current = built.totalMs;
      elapsedBeforePauseRef.current = 0;
    }

    const from = resume ? charAtElapsed(elapsedBeforePauseRef.current) : 0;
    if (resume && !text.slice(from).trim()) {
      start(false);
      return;
    }

    setFinished(false);
    setFailed(false);
    setIsPlaying(true);
    playingRef.current = true;
    playStartTsRef.current = Date.now();
    // Matn gaplarga bo'lib o'qiladi (telefonda uzun matn bitta bo'lak bo'lsa, o'rtada to'xtab qoladi)
    stopRef.current = speakChunks(text, lang, {
      rate: rate || 0.9,
      voiceURI,
      startAt: from,
      onChunk: (startIdx) => {
        // Ajratib ko'rsatish haqiqiy o'qilayotgan gapga moslab turiladi
        elapsedBeforePauseRef.current = timeAtChar(startIdx);
        playStartTsRef.current = Date.now();
      },
      onEnd: () => {
        halt();
        setIsPlaying(false);
        setFinished(true);
        spansRef.current.forEach((s) => {
          s.classList.remove('current');
          s.classList.add('read');
        });
      },
      onError: () => {
        halt();
        setIsPlaying(false);
        setFailed(true);
      },
    });
    rafRef.current = requestAnimationFrame(tick);
  }

  function pause() {
    stopRef.current?.();
    elapsedBeforePauseRef.current += Date.now() - playStartTsRef.current;
    setIsPlaying(false);
    halt();
  }

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    stopSpeaking();
    setIsPlaying(false);
    setFinished(false);
    elapsedBeforePauseRef.current = 0;
    halt();
    spansRef.current.forEach((s) => s.classList.remove('read', 'current'));
  }

  function togglePlay() {
    if (isPlaying) pause();
    else start(!finished && elapsedBeforePauseRef.current > 0);
  }

  const noVoice = hasVoiceFor(lang) === false;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button type="button" onClick={togglePlay} className="btn btn-primary">
          {isPlaying ? t('⏸ Pauza') : finished ? t("↺ Qayta o'qish") : t("▶ Ovoz bilan o'qish")}
        </button>
        {(isPlaying || elapsedBeforePauseRef.current > 0) && (
          <button type="button" onClick={stop} className="btn btn-ghost">
            {t("⏹ To'xtatish")}
          </button>
        )}

        <label className="flex items-center gap-2 text-xs font-semibold muted">
          {t('Tezlik')}
          <input
            type="range"
            min="0.5"
            max="1.4"
            step="0.1"
            value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="w-24"
            style={{ accentColor: 'var(--pine)' }}
          />
          <span className="font-mono">{rate.toFixed(1)}x</span>
        </label>

        {voices.length > 0 && (
          <select
            value={voiceURI || ''}
            onChange={(e) => onVoiceChange(e.target.value || null)}
            className="select !w-auto !py-2 text-xs"
          >
            <option value="">{t('Standart ovoz')}</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {noVoice && <div className="alert alert-warn text-sm mb-3">{t("Telefoningizda bu til uchun ovoz o'rnatilmagan, shuning uchun o'qish noto'g'ri chiqishi mumkin. Profil → Talaffuz ovozi bo'limida ko'rsatma bor.")}</div>}
      {failed && <div className="alert alert-warn text-sm mb-3">{t("Ovozli o'qish boshlanmadi. Ekranga bir marta bosib, qayta urinib ko'ring yoki telefoningiz ovozi (ovoz balandligi, «Ovozsiz» rejimi) ni tekshiring.")}</div>}

      <div
        ref={containerRef}
        className="card p-5 leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-[15px]"
        style={{ color: 'var(--ink)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
