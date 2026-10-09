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
   > `0005_v2_platform.sql` va `0006_email_phone_login.sql` ni ketma-ket ishga tushirish kifoya (eski
   > ma'lumotlar saqlanadi, kutubxona va lug'at to'plamlari yangi "Materiallar" bo'limiga avtomatik ko'chiriladi).
3. **Authentication → Sign In / Providers → Email:**
   - **Enable Email provider** — yoqilgan bo'lsin;
   - **Confirm email** — **O'CHIRING** (telefon raqami bilan ro'yxatdan o'tish ichki email orqali ishlaydi,
     unga tasdiqlash xati yuborib bo'lmaydi).
4. **Authentication → URL Configuration:**
   - *Site URL* = Netlify manzilingiz (masalan `https://til-sayohati.netlify.app`) — 3-bosqichdan keyin kiriting;
   - *Redirect URLs* ga qo'shing: `https://<sizning-sayt>.netlify.app/reset-password`
     (email orqali parolni tiklash uchun).
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
4. **Admin panel → 👥 Foydalanuvchilar** (chap menyuda ham bor) — ro'yxat, qidiruv, rol berish, bloklash,
   parolni tiklash, o'chirish; "+ Foydalanuvchi / admin" orqali yangi o'quvchi yoki admin qo'shing
   (login yoki email + ixtiyoriy telefon + parol).
5. **Chap menyu → Materiallar** — musiqa, video, rasm, matn, dialog, lug'at va yangiliklarni yuklang.

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
| Telefon bilan kirib bo'lmayapti (email bilan esa kiradi) | `admin` funksiyasi joylanmagan yoki `0006_email_phone_login.sql` ishga tushirilmagan |
| "Juda ko'p noto'g'ri urinish" | 15 daqiqada 10 marta noto'g'ri parol — 15 daqiqa kuting yoki admin parolni tiklasin |
| Fayl yuklanmayapti, "bucket topilmadi" | `setup_full.sql` (yoki `0005_v2_platform.sql`) ishga tushirilmagan |
| AI "Oddiy rejim" deb turibdi | Admin panelda faol API kalit yo'q yoki provayder "AI o'chiq" ga qo'yilgan |
| Kalit sinovida 429 xato | Bepul limit tugagan — ertaga tiklanadi yoki yana bir kalit qo'shing |
