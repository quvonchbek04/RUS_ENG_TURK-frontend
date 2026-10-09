import { useEffect, useState } from 'react';
import { t } from '../i18n/index.js';
import { Rich } from '../i18n/react.jsx';

/** Soniyalab kamayib boradigan taymer (kodni qayta yuborish uchun). */
export function useCooldown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft];
}

/** 6 xonali tasdiqlash kodi maydoni + "qayta yuborish" tugmasi.
 *  channel: 'email' (standart) — emailga kelgan kod; 'telegram' — Telegram botdan kelgan kod (qayta yuborish tugmasisiz). */
export default function CodeField({ value, onChange, email, cooldown, onResend, resending = false, autoFocus = true, channel = 'email' }) {
  return (
    <div className="field">
      <span className="label">{channel === 'telegram' ? t('✈️ Telegram botdan kelgan 6 xonali kod') : t('📧 Emailga kelgan 6 xonali kod')}</span>
      <input
        className="input text-center font-mono text-2xl tracking-[0.5em]"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        autoFocus={autoFocus}
        required
        aria-label={t('Tasdiqlash kodi')}
      />
      {channel === 'email' && (
        <>
          <div className="help leading-relaxed">
            <Rich text={t('**{email}** manziliga kod yuborildi (10 daqiqa amal qiladi). Xat kelmasa, **Spam** papkasini ham tekshiring.', { email })} />
          </div>
          <button type="button" className="text-sm font-bold mt-2 disabled:opacity-60" style={{ color: 'var(--pine)' }} onClick={onResend} disabled={cooldown > 0 || resending}>
            {resending ? t('Yuborilmoqda…') : cooldown > 0 ? t('Kodni qayta yuborish ({n} s)', { n: cooldown }) : t('↻ Kodni qayta yuborish')}
          </button>
        </>
      )}
    </div>
  );
}
