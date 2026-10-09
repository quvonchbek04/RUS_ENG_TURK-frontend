import { useEffect, useState } from 'react';

/** Soniyalab kamayib boradigan taymer (kodni qayta yuborish uchun). */
export function useCooldown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

/** 6 xonali email tasdiqlash kodi maydoni + "qayta yuborish" tugmasi. */
export default function CodeField({ value, onChange, email, cooldown, onResend, resending = false, autoFocus = true }) {
  return (
    <div className="field">
      <span className="label">📧 Emailga kelgan 6 xonali kod</span>
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
        aria-label="Tasdiqlash kodi"
      />
      <div className="help leading-relaxed">
        <b style={{ color: 'var(--ink)' }}>{email}</b> manziliga kod yuborildi (10 daqiqa amal qiladi). Xat kelmasa, <b>Spam</b> papkasini ham tekshiring.
      </div>
      <button type="button" className="text-sm font-bold mt-2 disabled:opacity-60" style={{ color: 'var(--pine)' }} onClick={onResend} disabled={cooldown > 0 || resending}>
        {resending ? 'Yuborilmoqda…' : cooldown > 0 ? `Kodni qayta yuborish (${cooldown} s)` : '↻ Kodni qayta yuborish'}
      </button>
    </div>
  );
}
