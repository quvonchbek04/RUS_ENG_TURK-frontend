import { t } from '../i18n/index.js';
import CodeField from './CodeField.jsx';

/** Telefon raqamini Telegram bot orqali tasdiqlash bosqichi: bot havolasi + botdan kelgan 6 xonali kod maydoni.
 *  link — api.tgStart() qaytargan havola; code/onCode — kiritilgan kod; onRestart — yangi so'rov (yangi havola) boshlash. */
export default function TelegramVerify({ link, phone, code, onCode, onRestart, restarting = false, autoFocus = false }) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
      <div className="font-bold" style={{ color: 'var(--ink)' }}>
        {t('✈️ Telefon raqamini Telegram orqali tasdiqlang')}
        {phone ? <span className="muted font-normal"> · {phone}</span> : null}
      </div>
      <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: 'var(--ink)' }}>
        <li>{t('«Telegramni ochish» tugmasini bosing — bot ochiladi.')}</li>
        <li>{t('Botda «Start» (Boshlash) tugmasini bosing.')}</li>
        <li>{t('«📱 Raqamni ulashish» tugmasini bosing (faqat o\'zingizning raqamingiz qabul qilinadi).')}</li>
        <li>{t('Bot yuborgan 6 xonali kodni pastga kiriting.')}</li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <a href={link} target="_blank" rel="noreferrer" className="btn btn-soft">
          {t('✈️ Telegramni ochish')}
        </a>
        <button type="button" className="text-sm font-bold disabled:opacity-60" style={{ color: 'var(--pine)' }} onClick={onRestart} disabled={restarting}>
          {restarting ? t('Yuborilmoqda…') : t('↻ Qaytadan boshlash')}
        </button>
      </div>
      <CodeField channel="telegram" value={code} onChange={onCode} autoFocus={autoFocus} />
    </div>
  );
}
