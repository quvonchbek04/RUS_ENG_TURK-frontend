import { Link } from 'react-router-dom';
import TtsReader from './TtsReader.jsx';
import SpeakButton from './SpeakButton.jsx';
import AiTaskWidget from './AiTaskWidget.jsx';
import { DialogView } from './LessonExtras.jsx';
import { AiText } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { readingHint } from '../lib/translit.js';

/** Bitta materialni turiga qarab ko'rsatadi (modal ichida yoki sahifada). */
export default function MediaViewer({ item, onEnded, autoPlay = false }) {
  const { progress, updateProgress } = useAuth();
  const lang = item.lang === 'all' ? 'en' : item.lang;
  const voice = progress.voiceSettings?.[lang] || { rate: 0.9, voiceURI: null };
  const text = item.content?.text || '';

  function setVoice(patch) {
    updateProgress((prev) => {
      const voiceSettings = { ...(prev.voiceSettings || {}) };
      voiceSettings[lang] = { ...voice, ...patch };
      return { ...prev, voiceSettings };
    });
  }

  return (
    <div>
      {item.description && <p className="muted mb-3">{item.description}</p>}

      {item.kind === 'audio' && item.fileUrl && (
        <audio key={item.id} controls autoPlay={autoPlay} preload="metadata" src={item.fileUrl} onEnded={onEnded} className="w-full mb-4" />
      )}
      {item.kind === 'video' && item.fileUrl && (
        <video key={item.id} controls autoPlay={autoPlay} playsInline preload="metadata" src={item.fileUrl} onEnded={onEnded} className="w-full rounded-2xl mb-4 bg-black max-h-[70vh]" />
      )}
      {item.kind === 'image' && item.fileUrl && <img src={item.fileUrl} alt={item.title} className="w-full rounded-2xl mb-4 object-contain max-h-[75vh]" />}
      {item.kind === 'news' && item.fileUrl && <img src={item.fileUrl} alt="" className="w-full rounded-2xl mb-4 object-cover max-h-80" />}

      {item.kind === 'text' && (
        <>
          <TtsReader
            text={text}
            lang={lang}
            rate={voice.rate ?? 0.9}
            voiceURI={voice.voiceURI}
            onRateChange={(rate) => setVoice({ rate })}
            onVoiceChange={(voiceURI) => setVoice({ voiceURI })}
          />
          <AiTaskWidget type="text" content={text.slice(0, 6000)} lang={lang} title="Matn bo'yicha AI vazifa" />
        </>
      )}

      {item.kind === 'dialog' && (
        <>
          <DialogView lines={item.content?.lines || []} lang={lang} audioUrl={item.fileUrl} />
          <AiTaskWidget
            type="dialog"
            content={(item.content?.lines || []).map(([s, l, t]) => `${s}: ${l}${t ? ` (${t})` : ''}`).join('\n')}
            lang={lang}
            title="Dialog bo'yicha AI vazifa"
          />
        </>
      )}

      {item.kind === 'vocab' && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <Link to={`/lang/${lang}/practice-full?source=uploaded&set=${item.id}`} className="btn btn-primary btn-sm">
              🔀 Shu lug'at bilan mashq qilish
            </Link>
            <span className="badge">{(item.content?.words || []).length} ta so'z</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {(item.content?.words || []).map(([w, t, m], i) => {
              const hint = readingHint(w, lang) || (t !== w ? t : '');
              return (
                <div key={i} className="card-soft p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold" style={{ color: 'var(--ink)' }}>
                      {w}
                    </div>
                    {hint && <div className="font-mono text-xs" style={{ color: 'var(--gold)' }}>{hint}</div>}
                    <div className="text-sm muted">{m}</div>
                  </div>
                  <SpeakButton text={w} lang={lang} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {(item.kind === 'audio' || item.kind === 'video' || item.kind === 'image' || item.kind === 'news') && text && (
        <div className="card-soft p-4 text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>
          {item.kind === 'news' ? <AiText text={text} /> : text}
        </div>
      )}
    </div>
  );
}
