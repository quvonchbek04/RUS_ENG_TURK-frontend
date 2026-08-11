import { speakSimple } from '../lib/tts.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function SpeakButton({ text, lang, size = 'sm', className = '' }) {
  const { progress } = useAuth();
  const settings = progress.voiceSettings?.[lang] || {};

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    speakSimple(text, lang, { rate: settings.rate ?? 0.9, voiceURI: settings.voiceURI });
  }

  const dim = size === 'lg' ? 'w-9 h-9 text-base' : 'w-7 h-7 text-sm';

  return (
    <button
      onClick={handleClick}
      title="Talaffuzni eshitish"
      className={`${dim} rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${className}`}
      style={{ background: 'var(--paper-soft)', color: 'var(--pine)' }}
    >
      🔊
    </button>
  );
}
