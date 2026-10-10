import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { t } from '../../i18n/index.js';
import { Rich } from '../../i18n/react.jsx';

function Switch({ on, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60"
      style={{ background: on ? 'var(--pine)' : 'var(--paper-soft)', border: '1px solid var(--line)' }}
    >
      <span className="absolute top-0.5 w-6 h-6 rounded-full shadow transition-all" style={{ left: on ? 22 : 2, background: '#fff' }} />
    </button>
  );
}

function Choice({ selected, onClick, disabled = false, title, text, badge }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className="card p-3 text-left disabled:opacity-60"
      style={selected ? { borderColor: 'var(--pine)', boxShadow: '0 0 0 3px var(--pine-soft)' } : undefined}
    >
      <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
        {selected ? '● ' : '○ '}
        {title} {badge && <span className="badge badge-pine ml-1">{badge}</span>}
      </div>
      <div className="text-xs muted mt-1">{text}</div>
    </button>
  );
}

/** Admin panel → "🛡️ Ro'yxatdan o'tish" (faqat super admin): qaysi usullar bilan ro'yxatdan o'tish mumkin,
 *  email kodi, Telegram orqali telefon tasdiqlash va Telegram botni ulash. */
export default function SignupPanel() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [token, setToken] = useState('');
  const [tgBusy, setTgBusy] = useState(false);
  const [tgMsg, setTgMsg] = useState(null);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    api
      .getSignupSettings()
      .then(setS)
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);

  async function patch(p) {
    setBusy(true);
    setMsg(null);
    try {
      setS(await api.saveSignupSettings(p));
      setMsg({ ok: true, text: t('✅ Saqlandi') });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function saveBot(e) {
    e.preventDefault();
    setTgBusy(true);
    setTgMsg(null);
    setCheck(null);
    try {
      setS(await api.tgSaveBot(token));
      setToken('');
      setTgMsg({ ok: true, text: t('✅ Bot ulandi. Endi «Telegram bot orqali (bepul)» usulini yoki telefon uchun Telegram tasdiqlashni yoqishingiz mumkin.') });
    } catch (err) {
      setTgMsg({ ok: false, text: err.message });
    } finally {
      setTgBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(t("Telegram bot uzilsinmi? Telegram orqali ro'yxatdan o'tish va tasdiqlash o'chadi."))) return;
    setTgBusy(true);
    setTgMsg(null);
    setCheck(null);
    try {
      setS(await api.tgSaveBot(''));
      setTgMsg({ ok: true, text: t('Bot uzildi.') });
    } catch (err) {
      setTgMsg({ ok: false, text: err.message });
    } finally {
      setTgBusy(false);
    }
  }

  async function runCheck() {
    setTgBusy(true);
    setCheck(null);
    try {
      setCheck(await api.tgCheck());
    } catch (err) {
      setCheck({ ok: false, error: err.message });
    } finally {
      setTgBusy(false);
    }
  }

  if (!s) {
    return msg ? <div className="alert alert-error max-w-3xl">{msg.text}</div> : <div className="skeleton h-64 max-w-3xl" />;
  }

  const tgConnected = !!s.tg?.connected;
  const anyOn = s.login || s.email || s.phone || s.telegram;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">🛡️</span>
          <div className="flex-1 min-w-[220px]">
            <div className="h2">{t("Ro'yxatdan o'tish usullari")}</div>
            <div className="text-sm muted">
              {t("Foydalanuvchilar faqat siz yoqqan usullar bilan o'zlari ro'yxatdan o'ta oladi. Hisobni siz o'zingiz qo'shsangiz (Foydalanuvchilar bo'limi), bu qoidalar ta'sir qilmaydi.")}
            </div>
          </div>
          {busy && <span className="spinner" />}
        </div>

        {!anyOn && <div className="alert alert-warn text-sm mt-4">{t("Hech bir usul yoqilmagan — hozir hech kim ro'yxatdan o'ta olmaydi.")}</div>}

        <div className="mt-4 space-y-3">
          {/* 1. Oddiy usul */}
          <div className="card-soft p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">👤</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--ink)' }}>
                  {t('Oddiy: ism + login + parol')}
                </div>
                <div className="text-sm muted">{t("Email ham, telefon ham kerak emas, tasdiqlash yo'q — eng oson usul. Parolni unutsa, uni faqat admin tiklay oladi.")}</div>
              </div>
              <Switch on={s.login} disabled={busy} onChange={(v) => patch({ login: v })} label={t('Oddiy usul')} />
            </div>
          </div>

          {/* 2. Email */}
          <div className="card-soft p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📧</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--ink)' }}>
                  {t('Email bilan')}
                </div>
                <div className="text-sm muted">{t("Foydalanuvchi emailini kiritadi va u bilan kiradi; parolni email orqali tiklay oladi.")}</div>
              </div>
              <Switch on={s.email} disabled={busy} onChange={(v) => patch({ email: v })} label={t('Email bilan')} />
            </div>
            {s.email && (
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <Choice
                  selected={s.emailCode}
                  disabled={busy}
                  onClick={() => !s.emailCode && patch({ emailCode: true })}
                  title={t('Tasdiqlash kodi bilan')}
                  badge={t('Tavsiya')}
                  text={t("Emailga 6 xonali kod yuboriladi; kod kiritilgandan keyingina hisob ochiladi. Email xizmati sozlangan bo'lishi kerak.")}
                />
                <Choice
                  selected={!s.emailCode}
                  disabled={busy}
                  onClick={() => s.emailCode && patch({ emailCode: false })}
                  title={t('Kodsiz')}
                  text={t("Email shunchaki saqlanadi, tasdiqlanmaydi. Email xizmati kerak emas. Birovning emailini yozib ro'yxatdan o'tish mumkin.")}
                />
              </div>
            )}
            {s.email && s.emailCode && !s.mailReady && (
              <div className="alert alert-warn text-sm mt-3">{t("Kod yoqilgan, lekin Email xizmati hali sozlanmagan — email bilan ro'yxatdan o'tish ishlamaydi. «✉️ Email xizmati» bo'limida sozlang yoki vaqtincha «Kodsiz» ni tanlang.")}</div>
            )}
          </div>

          {/* 3. Telefon */}
          <div className="card-soft p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📱</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--ink)' }}>
                  {t('Telefon raqami bilan')}
                </div>
                <div className="text-sm muted">{t('Foydalanuvchi telefon raqamini kiritadi va u bilan kiradi.')}</div>
              </div>
              <Switch on={s.phone} disabled={busy} onChange={(v) => patch({ phone: v })} label={t('Telefon raqami bilan')} />
            </div>
            {s.phone && (
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <Choice
                  selected={!s.phoneTelegram}
                  disabled={busy}
                  onClick={() => s.phoneTelegram && patch({ phoneTelegram: false })}
                  title={t('Kodsiz')}
                  text={t("Raqam tasdiqlanmaydi (SMS yo'q). Birovning raqamini yozish mumkin.")}
                />
                <Choice
                  selected={s.phoneTelegram}
                  disabled={busy || !tgConnected}
                  onClick={() => !s.phoneTelegram && patch({ phoneTelegram: true })}
                  title={t('Telegram bot orqali tasdiqlash')}
                  badge={t('Tavsiya')}
                  text={tgConnected ? t("Bot raqam egasini tekshiradi va Telegramga 6 xonali kod yuboradi. Bepul.") : t('Avval pastda Telegram botni ulang.')}
                />
              </div>
            )}
          </div>

          {/* 4. Telegram bot orqali (bepul) */}
          <div className="card-soft p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✈️</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: 'var(--ink)' }}>
                  {t('Telegram bot orqali (bepul)')} <span className="badge badge-pine ml-1">{t('Bepul')}</span>
                </div>
                <div className="text-sm muted">
                  {t("Foydalanuvchi ro'yxatdan o'tish sahifasidagi tugma orqali botni ochadi va «Raqamni ulashish» ni bosadi — raqami avtomatik tasdiqlanadi, kod yozish shart emas. Keyin saytda ism va parol kiritadi.")}
                </div>
                {!tgConnected && <div className="text-xs mt-1" style={{ color: 'var(--brick)' }}>{t('Avval pastda Telegram botni ulang.')}</div>}
              </div>
              <Switch on={s.telegram} disabled={busy || (!tgConnected && !s.telegram)} onChange={(v) => patch({ telegram: v })} label={t('Telegram bot orqali (bepul)')} />
            </div>
          </div>
        </div>

        {msg && <div className={`alert mt-4 text-sm ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
      </div>

      {/* Telegram bot */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">✈️</span>
          <div className="flex-1 min-w-[220px]">
            <div className="h2">{t('Telegram bot')}</div>
            <div className="text-sm muted">{t("Bot ikki ish qiladi: telefon raqamini tasdiqlaydi (kod Telegramga yuboriladi) va Telegram orqali ro'yxatdan o'tishga imkon beradi. Botni bir marta ulaysiz — keyin hammasi avtomatik ishlaydi.")}</div>
          </div>
          <span className={`badge ${tgConnected ? 'badge-pine' : 'badge-brick'}`}>{tgConnected ? `✓ @${s.tg.username}` : t('Ulanmagan')}</span>
        </div>

        <form onSubmit={saveBot} className="mt-4">
          <label className="field">
            <span className="label">
              {t('Bot tokeni')} {tgConnected && <span className="badge badge-pine ml-1">{t('saqlangan: {key}', { key: s.tg.maskedToken })}</span>}
            </span>
            <input
              className="input font-mono"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={tgConnected ? t("O'zgartirmaslik uchun bo'sh qoldiring") : '123456789:AAH…'}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button type="submit" className="btn btn-primary" disabled={tgBusy || !token.trim()}>
              {tgBusy ? <><span className="spinner" /> {t('Ulanmoqda…')}</> : t('Ulash')}
            </button>
            {tgConnected && (
              <>
                <button type="button" className="btn btn-soft" onClick={runCheck} disabled={tgBusy}>
                  {t('Tekshirish')}
                </button>
                <button type="button" className="btn btn-danger" onClick={disconnect} disabled={tgBusy}>
                  {t('Uzish')}
                </button>
              </>
            )}
          </div>
        </form>

        {tgMsg && <div className={`alert mt-3 text-sm ${tgMsg.ok ? 'alert-success' : 'alert-error'}`}>{tgMsg.text}</div>}
        {check && (
          <div className={`alert mt-3 text-sm ${check.ok && check.webhookOk ? 'alert-success' : 'alert-warn'}`}>
            {check.ok ? (
              <>
                <div>{check.webhookOk ? t('✅ Bot @{name} ishlayapti, webhook ulangan.', { name: check.username }) : t("⚠️ Bot @{name} topildi, lekin webhook shu saytga ulanmagan. Tokenni qayta kiritib «Ulash» ni bosing.", { name: check.username })}</div>
                {check.pending > 0 && <div className="mt-1">{t('Kutilayotgan yangilanishlar: {n}', { n: check.pending })}</div>}
                {check.lastError && <div className="mt-1">{t('Telegram oxirgi xatosi: {text}', { text: check.lastError })}</div>}
              </>
            ) : (
              `❌ ${check.error}`
            )}
          </div>
        )}

        <details className="mt-5 card-soft p-4" open={!tgConnected}>
          <summary className="font-bold cursor-pointer" style={{ color: 'var(--ink)' }}>
            {t('📘 Botni yaratish — qadamlar')}
          </summary>
          <ol className="list-decimal pl-5 mt-3 space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
            <li>
              <Rich text={t("Telegram'da **@BotFather** ni oching va `/newbot` buyrug'ini yuboring.")} />
            </li>
            <li>{t("Bot uchun nom (masalan: Til sayohati) va username (oxiri «bot» bilan tugashi shart, masalan: til_sayohati_bot) kiriting.")}</li>
            <li>{t("BotFather yuborgan tokenni (123456789:AAH… ko'rinishida) nusxalab, yuqoridagi maydonga joylang va «Ulash» ni bosing.")}</li>
            <li>{t("Kerakli usulni yoqing: yuqorida «Telegram bot orqali (bepul)» yoki «Telefon raqami bilan» ichida «Telegram bot orqali tasdiqlash».")}</li>
          </ol>
          <p className="text-xs muted mt-3 leading-relaxed">
            {t("Token faqat serverda saqlanadi va brauzerga hech qachon yuborilmaydi. Bot foydalanuvchiga o'zi birinchi yoza olmaydi — foydalanuvchi sayt bergan havola orqali botni bir marta ochishi kerak. Raqami botda bir marta tasdiqlangan foydalanuvchiga keyingi kodlar Telegramga darhol yuboriladi (parolni tiklash ham shu orqali ishlaydi).")}
          </p>
        </details>
      </div>
    </div>
  );
}
