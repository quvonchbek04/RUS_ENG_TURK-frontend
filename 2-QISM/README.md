# Til sayohati v2 — ingliz, rus va turk tillari (o'zbek tilida)

Bosqichma-bosqich til o'rganish platformasi: 33 tadan dars (A1 → C1), lug'at mashqi, dialoglar,
grammatika, yuklanadigan materiallar (musiqa, video, rasm, matn, dialog, lug'at, yangiliklar) va AI ustoz.
Telefonga to'liq moslashgan (pastki menyu, ilova sifatida o'rnatish — PWA).

**Ishga tushirish bo'yicha qo'llanma:** [DEPLOY.md](DEPLOY.md) · **Texnik topshiriq:** [TEXNIK_TOPSHIRIQ.md](TEXNIK_TOPSHIRIQ.md)

Super admin (avtomatik yaratiladi): **login `quvonchbek` · parol `admin123`** — birinchi kirishdan keyin parolni almashtiring.

## Imkoniyatlar

| Bo'lim | Nima qiladi |
|---|---|
| Ro'yxatdan o'tish | **Email va telefon bir vaqtda** (yoki faqat bittasi) + parol; oddiy usul (ism + login + parol); **Telegram bot orqali bepul** (sahifa pastidagi tugma → botda kontaktni ulashish → ism va parol); kirish — email, telefon yoki login, qaysi biri qulay bo'lsa; profilda email/telefonni keyin qo'shish; "meni eslab qol"; parolni email yoki Telegram orqali tiklash; ko'p noto'g'ri urinishdan himoya |
| Darslar | Har bir dars 7 bosqichli stepper: Grammatika → Lug'at (ro'yxat + kartochkalar) → Dialog (+ 2-dialog va o'qish matni) → Mashqlar (AI tekshiruvi bilan) → Javoblar → Tavsiya → Test. Darsga biriktirilgan materiallar |
| Dialoglar | Butun dialogni tinglash; **🎭 Rolli o'qish** — rolni tanlaysiz, ilova suhbatdosh gaplarini o'qiydi, siz o'z gapingizni mikrofonga aytasiz va talaffuz foizda baholanadi |
| Word fayldagi ma'lumotlar | 2161 so'z (24 mavzu) va 297 ibora — misol gap va tarjimasi bilan — **uchala tilga** (ingliz, rus, turk) tarjima qilinib, darslarga taqsimlangan. Ikkinchi dialog va o'qish matni (savollari bilan) uchala kursning 33 tadan darsida |
| Lug'at mashqi | Manba (hamma so'zlar, dars, mavzu, iboralar, yuklangan lug'at, xatolarim), 5 xil savol turi (tanlash, teskari, yozish, tinglash, aralash), soni. **"To'xtatish"** bosilsa — natija va xatolar alohida ko'rsatiladi |
| Natijalar | Har bir mashq tarixi, xatolar ro'yxati (sizning javobingiz va to'g'ri javob), xatolar banki — xato qilingan so'zlar ustida qayta mashq |
| Materiallar (chap menyu) | 🎵 Musiqa · 🎬 Video · 💬 Dialoglar · 📚 Lug'atlar · 📄 Matnlar · 🖼 Rasmlar · 📰 Yangiliklar — ketma-ketlikda ochiladi (pleylist, galereya, o'qish rejimi) |
| AI ustoz | Istalgan sahifada ochiladigan chat (Ctrl/⌘+K), dars kontekstini biladi, ovoz bilan yozish, vazifa berish va javobni baholash (0–100) |
| Admin panel | Bosh ko'rinish (katta oynalar); **👥 Foydalanuvchilar** oynasi (super adminga to'liq; oddiy adminga — faqat super admin ruxsat bersa va faqat **o'quvchilar**) — jadval/kartochka ko'rinishidagi ro'yxat, qidiruv, filtr, saralash, qo'shish (login/email + telefon), rol berish (faqat super admin), parolni tiklash, bloklash, o'chirish, foydalanuvchi progressi; **🛡️ Ro'yxatdan o'tish** (usullar, email kodi, Telegram bot — faqat super admin); **🔐 Ruxsatlar** (har bir admin nimalarga ruxsati borligi: material yuklash bo'limlari va funksiyalar — o'quvchilarni ko'rish/qo'shish/bloklash/parol/o'chirish, AI, email, statistika — faqat super admin belgilaydi); **✉️ Email xizmati** (tasdiqlash kodlari uchun Brevo/Resend, email kodini yoqish/o'chirish); AI provayderlar va API kalitlar (sinash tugmasi bilan); materiallar; statistika |
| Profil | Shaxsiy ma'lumotlar, kirish ma'lumotlari (email/telefon), parol, talaffuz ovozi, sayt tili; adminlarda — **🔐 Mening ruxsatlarim** (nimaga ruxsati bor ✓ va nimaga yo'q ✕) |
| Qo'shimcha | Kunlik maqsad (XP), streak, haftalik faollik grafigi, tungi rejim, talaffuz ovozi sozlamalari |

## Tuzilma

```
til-sayohati/
├── frontend/                React 19 + Vite + Tailwind 4
│   ├── public/content/      Kurs kontenti: meta.json, en.json, ru.json, tr.json (skript yaratadi)
│   └── src/
│       ├── pages/           Sahifalar (Dashboard, MonthPage, VocabPracticeFull, MediaPage, AdminPage …)
│       ├── components/      Layout, Sidebar, AiTutorPanel, PracticeSession, PracticeResult, MediaUploader …
│       ├── context/         AuthContext (sessiya, progress), TutorContext (AI ustoz)
│       └── lib/             api.js (Supabase), practice.js, lessonProgress.js, identity.js, translit.js …
├── supabase/
│   ├── setup_full.sql       Yangi o'rnatish uchun yagona SQL fayl (0001…0011 birlashtirilgan)
│   ├── migrations/          Bosqichma-bosqich migratsiyalar
│   └── functions/           Edge Functions: admin (boshqaruv), ai (AI ustoz)
├── data-src/                Manba ma'lumotlar (Word fayllardan) va i18n/ — rus/turk tarjimalari (so'zlar, iboralar, dialog va o'qish matnlari)
├── scripts/build-content.mjs  data-src → frontend/public/content
├── DEPLOY.md · TEXNIK_TOPSHIRIQ.md · netlify.toml
```

## Lokal ishga tushirish

```
cd frontend
npm install
cp .env.example .env      # Supabase URL va anon kalitni yozing
npm run dev               # http://localhost:5173
```
`.env` bo'lmasa, `npm run dev` rejimida dizaynni ko'rib chiqish uchun **demo foydalanuvchi** bilan ochiladi
(progress brauzerda saqlanadi; production build'da bu rejim yo'q).

Kontentni qayta yig'ish: `node scripts/build-content.mjs`

## Xavfsizlik

- Barcha jadvallarda Row Level Security; o'quvchi faqat o'z progressini ko'radi, materiallarni faqat adminlar yozadi.
- Foydalanuvchilar ro'yxati va ularning ma'lumotlari sukut bo'yicha faqat **super adminga** ochiq (oddiy admin server va baza darajasida ham ko'ra olmaydi).
  Super admin adminga alohida funksiya ruxsatlari berishi mumkin (o'quvchilarni ko'rish, qo'shish, bloklash, parol, o'chirish; AI, email, statistika) —
  admin baribir **faqat o'quvchilarni** ko'radi. **Super admin va boshqa adminlarning ma'lumotlari (login, email, telefon) hech kimga ko'rinmaydi**;
  adminlarni boshqarish, rol berish va sozlamalar — faqat super admin.
- Email bilan ro'yxatdan o'tishda 6 xonali kod serverda avtomatik yaratilib yuboriladi (admin ishtirokisiz); telefon bilan kodsiz.
  Super admin buni panelda yoqishi yoki o'chirishi mumkin (Email xizmati → «Ro'yxatdan o'tishda email tasdiqlash»).
- Ro'yxatdan o'tish usullarini (oddiy: ism + login + parol / email / telefon / **Telegram bot orqali bepul**) super admin yoqadi va o'chiradi;
  email uchun kod bilan yoki kodsiz, telefon uchun kodsiz yoki **Telegram bot orqali tasdiqlash** (panel: «🛡️ Ro'yxatdan o'tish»).
  Forma va server faqat yoqilgan usullarni qabul qiladi. Raqami botda bir marta tasdiqlangan foydalanuvchiga keyingi kodlar Telegramga darhol yuboriladi.
- Sayt tili: o'zbek · rus · ingliz · turk (menyular, tugmalar, xabarlar va AI ustoz javoblari). Dars matnlaridagi tushuntirishlar o'zbek tilida qoladi.
- Adminlarning yuklash ruxsatlari bo'limlar bo'yicha (musiqa, video, rasm, matn, dialog, lug'at, yangilik) va funksiya ruxsatlari
  super admin panelida («🔐 Ruxsatlar») belgilanadi; yuklash — baza (RLS + Storage), funksiyalar — server (Edge Function) darajasida majburlanadi.
  Admin o'z ruxsatlarini profilida («🔐 Mening ruxsatlarim») ko'radi.
- Rol hech qachon ro'yxatdan o'tish ma'lumotidan olinmaydi (doim `user`); o'z rolini o'zgartirish trigger bilan bloklangan.
- API kalitlar `api_keys` jadvalida — klientdan butunlay yopiq, faqat Edge Function (service-role) o'qiydi, panelda faqat maskalangan ko'rinadi.
- AI uchun har bir o'quvchiga kunlik limit (admin panelda sozlanadi).
