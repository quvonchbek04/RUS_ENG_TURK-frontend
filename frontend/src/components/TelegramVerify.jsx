import { t } from '../i18n/index.js';
import CodeField from './CodeField.jsx';

/** Telefon raqamini Telegram bot orqali tasdiqlash bosqichi.
 *  Ikki holat:
 *   - direct=false — raqam botda hali tasdiqlanmagan: bot havolasi + qadamlar + botdan kelgan 6 xonali kod maydoni;
 *   - direct=true  — raqam avval tasdiqlangan: kod Telegramga allaqachon yuborilgan, faqat uni kiritish kerak.
 *  link — api.tgStart() qaytargan havola; code/onCode — kiritilgan kod; onRestart — yangi so'rov (yangi havola / yangi kod). */
export default function TelegramVerify({ link, direct = false, phone, code, onCode, onRestart, restarting = false, autoFocus = false }) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
      <div className="font-bold" style={{ color: 'var(--ink)' }}>
        {direct ? t('✈️ Kod Telegramga yuborildi') : t('✈️ Telefon raqamini Telegram orqali tasdiqlang')}
        {phone ? <span className="muted font-normal"> · {phone}</span> : null}
      </div>
      {direct ? (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
          {t('Telegramdagi bot chatiga 6 xonali kod keldi. Uni pastga kiriting (10 daqiqa amal qiladi).')}
        </p>
      ) : (
        <ol className="list-decimal pl-5 space-y-1 text-sm" style={{ color: 'var(--ink)' }}>
          <li>{t('«Telegramni ochish» tugmasini bosing — bot ochiladi.')}</li>
          <li>{t('Botda «Start» (Boshlash) tugmasini bosing.')}</li>
          <li>{t('«📱 Raqamni ulashish» tugmasini bosing (faqat o\'zingizning raqamingiz qabul qilinadi).')}</li>
          <li>{t('Bot yuborgan 6 xonali kodni pastga kiriting.')}</li>
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <a href={link} target="_blank" rel="noreferrer" className="btn btn-soft">
          {t('✈️ Telegramni ochish')}
        </a>
        <button type="button" className="text-sm font-bold disabled:opacity-60" style={{ color: 'var(--pine)' }} onClick={onRestart} disabled={restarting}>
          {restarting ? t('Yuborilmoqda…') : direct ? t('↻ Kodni qayta yuborish') : t('↻ Qaytadan boshlash')}
        </button>
      </div>
      <CodeField channel="telegram" value={code} onChange={onCode} autoFocus={autoFocus} />
    </div>
  );
}
