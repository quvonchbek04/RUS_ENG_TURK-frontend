import { useEffect, useState } from 'react';
import { LANG_BY_KEY } from './ui.jsx';
import { detectPlatform } from '../lib/install.js';
import { t } from '../i18n/index.js';

const shown = new Set(); // har bir til uchun sessiyada bir marta

/** Telefonda o'qiladigan til uchun ovoz o'rnatilmagan bo'lsa (lib/tts.js `tts-novoice` hodisasi), pastda qisqa ko'rsatma chiqaradi. */
export default function VoiceHint() {
  const [lang, setLang] = useState(null);

  useEffect(() => {
    const on = (e) => {
      const l = e.detail?.lang;
      if (!l || shown.has(l)) return;
      shown.add(l);
      setLang(l);
    };
    window.addEventListener('tts-novoice', on);
    return () => window.removeEventListener('tts-novoice', on);
  }, []);

  useEffect(() => {
    if (!lang) return undefined;
    const id = setTimeout(() => setLang(null), 25000);
    return () => clearTimeout(id);
  }, [lang]);

  if (!lang) return null;
  const name = LANG_BY_KEY[lang]?.label || lang;
  const ios = detectPlatform() === 'ios';
  return (
    <div className="fixed left-3 right-3 z-[60] sm:left-auto sm:right-6 sm:w-[420px]" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }} role="status">
      <div className="alert alert-warn text-sm shadow-lg flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold mb-1">{t("🔈 Telefoningizda «{name}» ovozi topilmadi", { name })}</div>
          <div className="leading-relaxed">
            {ios
              ? t("Sozlamalar → Maxsus imkoniyatlar → Ovozli kontent → Ovozlar bo'limidan shu tilni yuklab oling.")
              : t("Sozlamalar → Tizim → Til va kiritish → Matnni ovozga aylantirish (Google) → Ovoz ma'lumotlarini o'rnatish bo'limidan shu tilni yuklab oling.")}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-icon !w-8 !h-8 !min-h-8 shrink-0" aria-label={t('Yopish')} onClick={() => setLang(null)}>
          ✕
        </button>
      </div>
    </div>
  );
}
