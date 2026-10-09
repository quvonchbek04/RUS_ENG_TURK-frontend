import { speakSimple } from '../lib/tts.js';
import { useAuth } from '../context/AuthContext.jsx';
import { t } from '../i18n/index.js';

export default function SpeakButton({ text, lang, size = 'sm', className = '', title = t('Talaffuzni eshitish') }) {
  const { progress } = useAuth();
  const settings = progress.voiceSettings?.[lang] || {};

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    speakSimple(text, lang, { rate: settings.rate ?? 0.9, voiceURI: settings.voiceURI });
  }

  const dim = size === 'lg' ? 'w-11 h-11 text-lg' : 'w-8 h-8 text-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      className={`${dim} rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-90 ${className}`}
      style={{ background: 'var(--pine-soft)', color: 'var(--pine)' }}
    >
      🔊
    </button>
  );
}
