# Ishga tushirish: Supabase + GitHub + Netlify (qadam-baqadam)

Taxminiy vaqt: 20–30 daqiqa. Kerak bo'ladi: GitHub, Netlify va Supabase hisoblari (uchalasi ham bepul).

---

## 1. Supabase (baza, kirish tizimi, fayllar, AI funksiyalari)

1. **supabase.com → New project.** Nom bering, database parolini eslab qoling, mintaqa sifatida
   yaqinroq (masalan *Frankfurt*) ni tanlang.
2. **SQL Editor → New query.** `supabase/setup_full.sql` faylining **butun matnini** joylang va **Run** bosing.
   Bu bitta faylda hammasi bor: jadvallar, xavfsizlik (RLS) qoidalari, fayl saqlash joyi (`media` bucket),
   AI sozlamalari va **super admin** (login `quvonchbek`, parol `admin123`).
   > Avvalgi versiya o'rnatilgan bo'lsa — faqat `supabase/migrations/0004_seed_superadmin.sql`,
   > `0005_v2_platform.sql`, `0006_email_phone_login.sql`, `0007_email_codes.sql`,
   > `0008_users_super_only.sql`, `0009_admin_permissions.sql`, `0010_signup_methods_telegram.sql` va
   > `0011_admin_function_permissions.sql` ni ketma-ket ishga tushirish kifoya (eski ma'lumotlar saqlanadi,
   > kutubxona va lug'at to'plamlari yangi "Materiallar" bo'limiga avtomatik ko'chiriladi; mavjud adminlarga
   > hamma bo'limga yuklash ruxsati va "faqat ko'rish" funksiya ruxsatlari — AI, email, statistika — beriladi).
   > Shundan keyin **`admin` va `ai` funksiyalarini yangi kod bilan qayta joylang** (1.5-band).
3. **Authentication → Sign In / Providers:**
   - **Email provider** — yoqilgan bo'lsin; **Confirm email** — **O'CHIRING** (tasdiqlash kodini Supabase emas,
     ilovaning o'zi yuboradi; telefon bilan ro'yxatdan o'tish ichki email orqali ishlaydi, unga xat borib bo'lmaydi).
   - **Allow new users to sign up** — **O'CHIRIB QO'YING** (tavsiya etiladi). Hisoblar faqat `admin` funksiyasi
     orqali yaratiladi, shuning uchun email kodini chetlab o'tib bo'lmaydi. Bu o'chirilsa ham sayt ishlayveradi.
4. **Authentication → URL Configuration:** *Site URL* = Netlify manzilingiz (masalan `https://til-sayohati.netlify.app`) —
   3-bosqichdan keyin kiriting. (Parolni tiklash endi havola emas, email kodi orqali — *Redirect URLs* kerak emas.)
5. **Edge Functions** — ikkita funksiya joylanadi: `ai` va `admin`.
   - **A usul (CLI'siz, brauzerda):** Edge Functions → *Deploy a new function* → *Via Editor*.
     Nomi `admin`, kodini `supabase/functions/admin/index.ts` dan to'liq ko'chirib joylang → *Deploy*.
     Xuddi shunday `ai` funksiyasi uchun `supabase/functions/ai/index.ts`.
     Har bir funksiya sozlamasida **"Verify JWT with legacy secret" / "Enforce JWT"** ni **o'chiring**
     (funksiyalar foydalanuvchini o'zi tekshiradi). `admin` funksiyasi telefon yoki login bilan kirishni ham
     bajaradi (email + telefon bilan ro'yxatdan o'tganlar uchun) — u joylanmasa, bunday foydalanuvchilar
     faqat email bilan kira oladi.
   - **B usul (CLI):**
     ```
     npx supabase login
     npx supabase functions deploy admin --project-ref <REF> --no-verify-jwt
     npx supabase functions deploy ai --project-ref <REF> --no-verify-jwt
     ```
6. **Project Settings → API (API Keys):** `Project URL` va `anon public` (yoki `publishable`) kalitni ko'chirib oling.
   ⚠️ `service_role` / `secret` kalitni hech qayerga qo'ymang — u faqat Supabase ichida ishlaydi.

## 2. GitHub

Zip ichidagi `til-sayohati` papkasida:
```
git init
git add .
git commit -m "Til sayohati v2"
git branch -M main
git remote add origin https://github.com/<login>/<repo>.git
git push -u origin main
```
`.env` fayllari `.gitignore` da — maxfiy ma'lumot GitHub'ga chiqmaydi.

## 3. Netlify

1. **Add new site → Import an existing project → GitHub** → repozitoriyni tanlang.
   `netlify.toml` hamma narsani o'zi sozlaydi (papka `frontend`, buyruq `npm run build`, natija `dist`).
2. **Site configuration → Environment variables:**
   - `VITE_SUPABASE_URL` = Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable kalit
3. **Deploys → Trigger deploy → Deploy site** (o'zgaruvchilarni qo'shgandan keyin albatta qayta deploy qiling).
4. Sayt manzilini Supabase'dagi *Site URL* ga yozib qo'ying (1.4-band).

## 4. Birinchi kirish va sozlash

1. Saytni oching → login **`quvonchbek`**, parol **`admin123`**.
2. **Profil → Parolni o'zgartirish** — darhol yangi parol qo'ying.
3. **Admin panel → AI va API kalitlar → + Yangi kalit:**
   - eng oson yo'l — bepul **Google Gemini** kaliti: https://aistudio.google.com/apikey → "Create API key";
   - kalitni joylang → "Kalit qo'shish va sinash" → ✅ "Ishlayapti" chiqsa, AI ustoz to'liq ishlaydi.
   - Bir nechta kalit qo'shsangiz, biri limitga yetganda tizim avtomatik keyingisiga o'tadi.
4. **Admin panel → ✉️ Email xizmati** — email bilan ro'yxatdan o'tganlarga tasdiqlash kodi yuborish uchun
   (**bir marta sozlanadi, keyin kodlarni server o'zi 24 soat avtomatik yuboradi — admin tizimda bo'lishi shart emas**):
   - eng oson yo'l — **Brevo** (bepul, kuniga 300 ta xat, domen shart emas): brevo.com'da hisob oching →
     Senders bo'limida o'z emailingizni qo'shib, tasdiqlang → SMTP & API → API Keys'dan kalit oling;
   - kalitni va yuboruvchi emailni panelga kiriting → **Saqlash** → **Test xat yuborish**: xat kelsa, tayyor.
   - Sozlanmaguncha email bilan ro'yxatdan o'tish ishlamaydi, telefon bilan esa ishlayveradi.
   - Email kodini yoqish/o'chirish va boshqa usullar — keyingi band (🛡️ Ro'yxatdan o'tish).
5. **Admin panel → 🛡️ Ro'yxatdan o'tish** (faqat super admin) — **foydalanuvchilar qaysi usullar bilan o'zlari
   ro'yxatdan o'tishi mumkinligini** siz belgilaysiz (yoqish/o'chirish tugmalari):
   - 👤 **Oddiy: ism + login + parol** — email ham, telefon ham kerak emas, tasdiqlash yo'q (parolni faqat admin tiklaydi);
   - 📧 **Email bilan** — *tasdiqlash kodi bilan* (tavsiya; Email xizmati kerak) yoki *kodsiz* (email shunchaki saqlanadi,
     Email xizmati kerak emas — Brevo tayyor bo'lmaguncha vaqtincha qulay, lekin birovning emailini yozish mumkin);
   - 📱 **Telefon bilan** — *kodsiz* yoki **Telegram bot orqali tasdiqlash** (pastdagi qadamlarga qarang);
   - ✈️ **Telegram bot orqali (bepul)** — telefon raqami yozilmaydi: foydalanuvchi ro'yxatdan o'tish sahifasining
     **pastidagi** "✈️ Telegram bot orqali ro'yxatdan o'tish" tugmasini bosadi → bot ochiladi → *Start* → *Raqamni ulashish*;
     sayt buni o'zi sezadi (kod yozish shart emas), keyin foydalanuvchi ism va parol kiritadi. Keyin telefon raqami + parol bilan kiradi.
   Kamida bitta usul yoqilgan bo'lishi shart. Forma faqat yoqilgan usullarni ko'rsatadi; server ham yopiq usulni qabul qilmaydi.
   Siz o'zingiz qo'shgan hisoblarga (Foydalanuvchilar bo'limi) bu qoidalar ta'sir qilmaydi.
   **Telegram botni ulash (bir marta):**
   1. Telegram'da **@BotFather** → `/newbot` → nom va username (oxiri `bot` bilan, masalan `til_sayohati_bot`) bering;
   2. BotFather bergan **tokenni** (`123456789:AAH…`) nusxalab, shu bo'limdagi "Telegram bot" maydoniga joylang → **Ulash**.
      Webhook avtomatik o'rnatiladi (qo'shimcha sozlash kerak emas; `admin` funksiyasi joylangan va JWT tekshiruvi o'chiq bo'lishi shart);
   3. **Tekshirish** tugmasi bot va webhook ishlayotganini ko'rsatadi; keyin kerakli usulni yoqing: **"Telegram bot orqali
      (bepul)"** qatorini yoki "Telefon raqami bilan" blokida **"Telegram bot orqali tasdiqlash"** ni.
   Telefon tasdiqlash qanday ishlaydi: foydalanuvchi raqamini kiritadi → agar raqam botda **avval tasdiqlangan** bo'lsa, 6 xonali kod
   **darhol Telegramga yuboriladi** (botni qayta ochish shart emas); aks holda "Telegramni ochish" → botda *Start* → *Raqamni
   ulashish* (bot ulashilgan raqam o'sha foydalanuvchiniki va kiritilgan raqamga teng ekanini tekshiradi) → bot kod yuboradi →
   foydalanuvchi kodni saytga kiritadi. Bepul. Foydalanuvchida Telegram bo'lishi kerak. Profilda raqamni almashtirish ham shu orqali
   tasdiqlanadi. Parolni unutganda ham: "Parolni tiklash" sahifasida **✈️ Telegram** tanlanadi — kod raqam bog'langan Telegram chatiga keladi.
   > ⚠️ Telegram qoidasi: bot foydalanuvchiga **birinchi bo'lib yoza olmaydi**. Shuning uchun har bir foydalanuvchi botni hech bo'lmaganda
   > **bir marta** (sayt bergan havola orqali) ochishi shart; shundan keyin kodlar raqam yozilishi bilan Telegramga o'zi keladi.
   > Botni oldindan ochmagan foydalanuvchi uchun raqam yozilgach bot havolasi ko'rsatiladi. Ro'yxatdan o'tish sahifasining pastida
   > ham "🤖 Telegram botga o'tish" havolasi bor. (Telegram'ning pullik "Gateway" xizmati raqamga to'g'ridan-to'g'ri yozadi — bu loyihada ishlatilmagan.)
6. **Admin panel → 👥 Foydalanuvchilar** (chap menyuda ham bor) — ro'yxat, qidiruv, rol berish, bloklash,
   parolni tiklash, o'chirish; "+ Foydalanuvchi / admin" orqali yangi o'quvchi yoki admin qo'shing
   (login yoki email + ixtiyoriy telefon + parol; admin qo'shgan foydalanuvchilarga kod yuborilmaydi).
   > 🔒 **Bu bo'lim sukut bo'yicha faqat super adminga ko'rinadi.** Oddiy admin foydalanuvchilar ro'yxatini ko'rmaydi,
   > qo'sha/o'chira/bloklay olmaydi — server ham, ma'lumotlar bazasi ham ruxsat bermaydi. Super admin
   > "🔐 Ruxsatlar" bo'limida unga alohida funksiya ruxsatlarini berishi mumkin (keyingi band); u holda admin
   > **faqat o'quvchilarni** ko'radi va boshqaradi. **Super admin va boshqa adminlar** ro'yxatda adminga umuman ko'rinmaydi.
   > Yangi admin tayinlash — Foydalanuvchilar bo'limida rolni "Admin" qilish (faqat super admin).
7. **Admin panel → 🔐 Ruxsatlar** (chap menyuda ham bor, faqat super adminga) — har bir admin uchun nimalarga ruxsati
   borligini belgilaysiz:
   - **📤 Material yuklash** — qaysi bo'limlarda (Yangiliklar, Musiqa, Video, Dialoglar, Lug'atlar, Matnlar, Rasmlar) material
     yuklash, tahrirlash, o'chirish va tartiblash mumkin;
   - **⚙️ Funksiyalar** — 👁️ o'quvchilarni ko'rish · ➕ o'quvchi qo'shish · ⛔ bloklash · 🔑 parolni tiklash · 🗑️ o'quvchini o'chirish ·
     🤖 AI va API kalitlarni ko'rish · ✉️ Email xizmati holatini ko'rish · 📊 statistikani ko'rish.
   Bo'limni/funksiyani bosib ruxsat berasiz yoki olib tashlaysiz; "Hammasi" / "Hech biri" tugmalari bor. Yangi admin boshida
   hamma bo'limga yuklash va faqat ko'rish funksiyalarini (AI, email, statistika) oladi — keyin cheklaysiz yoki kengaytirasiz.
   Ruxsat berilmagan narsani admin ko'ra olmaydi ham, bajara olmaydi ham (bo'lim yashiriladi, server va baza rad etadi).
   **Adminlarni boshqarish, rol berish, ro'yxatdan o'tish usullari/Telegram bot, AI sozlamalari va API kalitlarni o'zgartirish,
   email xizmatini sozlash — faqat super admin**, ruxsat berib bo'lmaydi.
   Har bir admin o'z ruxsatlarini **Profil → 🔐 Mening ruxsatlarim** bo'limida (yoki chap menyudagi "Mening ruxsatlarim"
   orqali) ko'radi: nimaga ruxsati bor (✓), nimaga yo'q (✕) va nimalar faqat super adminga tegishli.
8. **Chap menyu → Materiallar** — musiqa, video, rasm, matn, dialog, lug'at va yangiliklarni yuklang
   (admin — faqat o'ziga ruxsat berilgan bo'limlarga).
9. **Sayt tili:** foydalanuvchi o'zbek, rus, ingliz yoki turk tilini tanlashi mumkin — kirish sahifasi yuqorisida, chap menyu
   pastida va Profil → Sozlamalarda. Menyular, tugmalar, xabarlar va AI ustoz javoblari tanlangan tilda chiqadi; dars
   materiallaridagi tushuntirishlar (grammatika matnlari, o'zbekcha tarjimalar) o'zbek tilida qoladi.

## 5. (Ixtiyoriy) Funksiyalarni avtomatik joylash

`.github/workflows/deploy-functions.yml` — GitHub Secrets'ga `SUPABASE_ACCESS_TOKEN` va
`SUPABASE_PROJECT_REF` qo'shsangiz, `supabase/functions/` o'zgarganda funksiyalar avtomatik yangilanadi.

## Kontentni yangilash

So'z va iboralar `data-src/` papkasida. O'zgartirgach:
```
node scripts/build-content.mjs
```
— `frontend/public/content/` qayta yig'iladi. Commit + push qiling, Netlify o'zi yangilaydi.

## Muammolar va yechimlar

| Belgi | Sabab va yechim |
|---|---|
| Kirish sahifasida "Supabase ulanmagan" | Netlify'da `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` yo'q yoki deploy qayta qilinmagan |
| "admin Edge Function'ga ulanib bo'lmadi" | `admin` funksiyasi joylanmagan yoki JWT tekshiruvi yoqiq qolgan (1.5-band) |
| Ro'yxatdan o'tishda "Email not confirmed" | Supabase'da *Confirm email* o'chirilmagan (1.3-band) |
| "Email xizmati hali sozlanmagan" | Admin panel → ✉️ Email xizmati bo'limida API kalit va yuboruvchi emailni kiriting (4.4-band) |
| Kod kelmayapti | Spam papkasini tekshiring; Email xizmati bo'limida "Test xat" yuboring — xato matni sababini ko'rsatadi (odatda yuboruvchi email tasdiqlanmagan yoki API kalit noto'g'ri) |
| "Bu emailga juda ko'p kod yuborildi" | Bir emailga soatiga 5 tadan ko'p kod yuborilmaydi — 1 soat kuting |
| "Ro'yxatdan o'tish vaqtincha o'chirilgan" yoki ro'yxatdan o'tib bo'lmayapti | `admin` funksiyasi yangi versiyada joylanmagan yoki `0007_email_codes.sql` ishga tushirilmagan |
| Telegram'dan kod kelmayapti | Admin panel → 🛡️ Ro'yxatdan o'tish → **Tekshirish**: webhook ulangan bo'lishi kerak (aks holda tokenni qayta kiritib **Ulash** bosing). Foydalanuvchi botda avval *Start*, keyin *Raqamni ulashish* tugmasini bosgan bo'lishi va ulashilgan raqam saytdagi raqamga teng bo'lishi shart |
| "Telegram orqali tasdiqlash yoqilmagan" | Super admin Telegram tasdiqlashni yoqmagan yoki bot ulanmagan |
| Ro'yxatdan o'tish sahifasida usullar yo'q / "ro'yxatdan o'tish yopiq" | Hech bir usul yoqilmagan: Admin panel → 🛡️ Ro'yxatdan o'tish |
| Ro'yxatdan o'tish sozlamalari saqlanmayapti / Telegram ishlamayapti | `0010_signup_methods_telegram.sql` ishga tushirilmagan yoki `admin` funksiyasi yangilanmagan |
| Admin yuklayotganda "ruxsatingiz yo'q" xabarini ko'ryapti | Super admin unga shu bo'limga ruxsat bermagan: Admin panel → 🔐 Ruxsatlar. Ruxsat berilgach admin sahifani yangilasin. `0009_admin_permissions.sql` ishga tushirilmagan bo'lsa, yuklash hamma uchun ishlamay qolishi mumkin |
| Admin "Bu amal uchun ruxsatingiz yo'q" / "faqat super admin uchun" xabarini ko'ryapti | Bu to'g'ri ishlashi: admin faqat super admin bergan funksiyalardan foydalanadi (Admin panel → 🔐 Ruxsatlar → ⚙️ Funksiyalar). Ruxsat berilgach admin sahifani yangilasin (yoki Profil → "Mening ruxsatlarim" → ↻ Yangilash). `0011_admin_function_permissions.sql` ishga tushirilmagan bo'lsa, funksiya ruxsatlari ishlamaydi |
| Telegram orqali ro'yxatdan o'tishda "ro'yxatdan o'tish tugmasi" ko'rinmayapti | Admin panel → 🛡️ Ro'yxatdan o'tish → "Telegram bot orqali (bepul)" yoqilmagan yoki bot ulanmagan; `0011_admin_function_permissions.sql` va `admin` funksiyasi yangilangan bo'lishi shart |
| Telegram botda "Raqamni ulashish" bosildi, lekin sayt davom etmayapti | Sayt holatni har 2 soniyada so'raydi — sahifa ochiq qolsin; so'rov 10 daqiqada eskiradi ("↻ Qaytadan boshlash"). Tekshirish tugmasida webhook ulanganini ko'ring |
| Raqam yozilganda kod Telegramga darhol kelmayapti | Raqam botda hali tasdiqlanmagan — foydalanuvchi bir marta botni havola orqali ochib, *Raqamni ulashish* ni bosishi kerak (Telegram bot birinchi bo'lib yoza olmaydi). Bot bloklangan bo'lsa ham shunday |
| Telefon bilan kirib bo'lmayapti (email bilan esa kiradi) | `admin` funksiyasi joylanmagan yoki `0006_email_phone_login.sql` ishga tushirilmagan |
| "Juda ko'p noto'g'ri urinish" | 15 daqiqada 10 marta noto'g'ri parol — 15 daqiqa kuting yoki admin parolni tiklasin |
| Fayl yuklanmayapti, "bucket topilmadi" | `setup_full.sql` (yoki `0005_v2_platform.sql`) ishga tushirilmagan |
| AI "Oddiy rejim" deb turibdi | Admin panelda faol API kalit yo'q yoki provayder "AI o'chiq" ga qo'yilgan |
| Kalit sinovida 429 xato | Bepul limit tugagan — ertaga tiklanadi yoki yana bir kalit qo'shing |
