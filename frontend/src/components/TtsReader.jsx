import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWordTimings, getVoicesFor, isSpeechSupported, langToBCP47 } from '../lib/tts.js';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const voices = useMemo(() => getVoicesFor(lang), [lang, isPlaying]);

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
      const t = timingsRef.current[i];
      if (!t) return;
      if (elapsed >= t.end) {
        span.classList.add('read');
        span.classList.remove('current');
      } else if (elapsed >= t.start) {
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
    if (elapsed < totalMsRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function getRemainingText(elapsedMs) {
    for (let i = 0; i < timingsRef.current.length; i++) {
      if (timingsRef.current[i].end > elapsedMs) {
        return text.slice(spansRef.current[i].dataset.start);
      }
    }
    return '';
  }

  function start(resume) {
    if (!isSpeechSupported()) {
      alert("Kechirasiz, bu brauzer ovozli o'qishni qo'llab-quvvatlamaydi.");
      return;
    }
    window.speechSynthesis.cancel();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

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

    const chunk = resume ? getRemainingText(elapsedBeforePauseRef.current) : text;
    if (resume && !chunk.trim()) {
      start(false);
      return;
    }

    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = langToBCP47(lang);
    u.rate = rate || 0.9;
    if (voiceURI) {
      const v = (window.speechSynthesis.getVoices() || []).find((x) => x.voiceURI === voiceURI);
      if (v) u.voice = v;
    }
    u.onend = () => {
      setIsPlaying(false);
      setFinished(true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      spansRef.current.forEach((s) => {
        s.classList.remove('current');
        s.classList.add('read');
      });
    };
    u.onerror = () => {
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    setFinished(false);
    setIsPlaying(true);
    playStartTsRef.current = Date.now();
    window.speechSynthesis.speak(u);
    rafRef.current = requestAnimationFrame(tick);
  }

  function pause() {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    elapsedBeforePauseRef.current += Date.now() - playStartTsRef.current;
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  function stop() {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    setIsPlaying(false);
    setFinished(false);
    elapsedBeforePauseRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    spansRef.current.forEach((s) => s.classList.remove('read', 'current'));
  }

  function togglePlay() {
    if (isPlaying) pause();
    else start(!finished && elapsedBeforePauseRef.current > 0);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={togglePlay}
          className="font-mono text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer font-semibold"
          style={{ background: 'var(--pine)', color: 'var(--paper)' }}
        >
          {isPlaying ? '⏸ Pauza' : finished ? "↺ Qayta o'ynash" : '▶️ O\'qish'}
        </button>
        {(isPlaying || elapsedBeforePauseRef.current > 0) && (
          <button
            onClick={stop}
            className="font-mono text-xs uppercase tracking-widest px-3 py-2.5 rounded-xl cursor-pointer border"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
          >
            ⏹ To'xtatish
          </button>
        )}

        <label className="flex items-center gap-2 font-mono text-xs" style={{ color: 'var(--ink-soft)' }}>
          Tezlik
          <input
            type="range"
            min="0.5"
            max="1.4"
            step="0.1"
            value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="w-24 accent-current"
          />
          <span className="font-mono">{rate.toFixed(1)}x</span>
        </label>

        {voices.length > 0 && (
          <select
            value={voiceURI || ''}
            onChange={(e) => onVoiceChange(e.target.value || null)}
            className="font-mono text-xs px-2 py-2 rounded-lg border"
            style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
          >
            <option value="">Standart ovoz</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        ref={containerRef}
        className="rounded-xl border p-5 leading-relaxed max-h-[50vh] overflow-y-auto whitespace-pre-wrap"
        style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
