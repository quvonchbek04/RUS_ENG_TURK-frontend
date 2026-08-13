# Til sayohati — Supabase asosidagi versiya

Bu loyiha endi alohida Node.js/Express backend talab qilmaydi. Butun backend
qismi **Supabase** (Postgres baza + Auth + Edge Functions) orqali ishlaydi.
Frontend (React + Vite) to'g'ridan-to'g'ri Supabase'ga ulanadi.

## 📁 Tuzilma

```
til-sayohati/
├── frontend/                    React + Vite ilova (o'zgarishsiz UI, ichki API qatlami Supabase'ga ulangan)
│   ├── public/content.json      Kurs kontenti (statik fayl — DB shart emas)
│   ├── src/lib/supabase.js      Supabase klient
│   ├── src/lib/api.js           Eski `api.*` interfeysi, endi Supabase orqali ishlaydi
│   └── .env.example
├── supabase/
│   ├── migrations/0001_init.sql Baza sxemasi + RLS siyosatlari + trigger
│   ├── migrations/0002_multi_api_keys.sql  Bir nechta AI API kalitini qo'llab-quvvatlash
│   ├── functions/admin/         Edge Function: admin yaratish/o'chirish, AI sozlamalari va API kalitlar
│   ├── functions/ai/            Edge Function: AI vazifa/tekshirish (Gemini yoki mock)
│   └── config.toml              Lokal Supabase CLI konfiguratsiyasi (ixtiyoriy)
└── _deprecated_express_backend/ Eski Express backend — ENDI ISHLATILMAYDI, faqat ma'lumotnoma
```

## 🧠 Nima uchun shunday qurildi

| Avvalgi (Express+SQLite) | Endi (Supabase) |
|---|---|
| `backend/src/db.js` (SQLite) | Supabase Postgres jadvallari + RLS |
| `backend/src/middleware/auth.js` (JWT) | Supabase Auth (sessiya avtomatik boshqariladi) |
| `backend/src/routes/*.js` | To'g'ridan-to'g'ri Supabase so'rovlari (`frontend/src/lib/api.js` ichida) |
| `backend/src/ai/provider.js` + `/ai` route | `supabase/functions/ai` (Edge Function, Gemini kaliti xavfsiz saqlanadi) |
| Admin yaratish/o'chirish (`requireRole`) | `supabase/functions/admin` (service-role, superadmin tekshiruvi) |
| `backend/data/content.json` (fayldan o'qiladi) | `frontend/public/content.json` (statik, bevosita frontenddan) |

**Muhim:** `frontend/src/lib/api.js` dagi `api` obyektining barcha metod nomlari
va qaytaradigan natija shakli **avvalgidek saqlangan** — shuning uchun boshqa
hech qanday sahifa yoki komponentni (Library, AdminPage, MonthPage va h.k.)
o'zgartirish shart bo'lmadi.

---

## 🚀 SOZLASH — qadam-baqadam

### 1) Supabase loyihasini yarating

1. https://supabase.com → **New Project**.
2. Loyiha yaratilgach, **Project Settings → API** bo'limidan quyidagilarni oling:
   - `Project URL`
   - `anon public` kalit
   - `service_role` kalit (⚠️ **maxfiy**, hech qachon frontendga qo'ymang)

### 2) Bazani sozlang

**SQL Editor** bo'limini oching va `supabase/migrations/0001_init.sql` faylining
**butun matnini** ko'chirib, ishga tushiring (bir marta yetarli). Bu jadvallar,
RLS siyosatlari va trigger'larni yaratadi.

Shundan so'ng **`supabase/migrations/0002_multi_api_keys.sql`** faylini ham xuddi
shu tarzda ishga tushiring — bu bir nechta AI API kalitini saqlash imkonini
beruvchi `api_keys` jadvalini qo'shadi (agar avval bitta Gemini kalit
saqlagan bo'lsangiz, u avtomatik shu yangi jadvalga ko'chiriladi, yo'qolib
qolmaydi).

### 3) Edge Functions'ni deploy qiling

Kompyuteringizda [Supabase CLI](https://supabase.com/docs/guides/cli) o'rnating, so'ng:

```bash
supabase login
supabase link --project-ref <sizning-loyiha-ref>
supabase functions deploy admin
supabase functions deploy ai
```

Edge Function'lar ichida ishlatiladigan environment o'zgaruvchilari (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) Supabase tomonidan **avtomatik**
beriladi — qo'lda sozlash shart emas. Faqat ixtiyoriy ravishda modelni
o'zgartirmoqchi bo'lsangiz:

```bash
supabase secrets set GEMINI_MODEL=gemini-2.0-flash
```

### 4) Frontendni sozlang

```bash
cd frontend
npm install
cp .env.example .env
```

`.env` faylini oching va Supabase'dan olgan `Project URL` va `anon public`
kalitni qo'ying:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Ishga tushiring:

```bash
npm run dev
```

`http://localhost:5173` da ochiladi.

### 5) Birinchi super admin'ni yarating

1. Saytda **"Ro'yxatdan o'tish"** orqali login=`Quvonchbek`, parol=`admin123`
   bilan oddiy foydalanuvchi sifatida ro'yxatdan o'ting.
2. Supabase **SQL Editor**'da ishga tushiring:
   ```sql
   update public.profiles set role = 'superadmin' where username = 'Quvonchbek';
   ```
3. Saytga qayta kiring — endi admin panelga kirish imkoniyati paydo bo'ladi.

### 6) (Ixtiyoriy) Gemini AI'ni yoqish

Admin panel → **AI sozlamalari** bo'limida:
1. Provayderni **"Gemini (AI yoqilgan)"** ga o'zgartirib, "Saqlash"ni bosing.
2. Pastdagi **"+ Kalit qo'shish"** formasi orqali Gemini API kalitingizni
   (https://aistudio.google.com/apikey — bepul) kiriting.

**Bir nechta kalit qo'shish mumkin** — masalan bir nechta Google akkauntdan
olingan bepul kalitlarni qo'shsangiz, tizim ulardan birini ishlatadi va
agar u kunlik/daqiqalik limitga (quota) tegib qolsa, **avtomatik ravishda**
keyingi faol kalitga o'tadi. Har bir kalit qancha marta xato bergani va
oxirgi xatosi admin panelida ko'rinadi; xohlagan vaqtda kalitni vaqtincha
o'chirib qo'yish yoki butunlay o'chirish mumkin.

API kalit(lar) **hech qachon** frontendga chiqmaydi — ular faqat
`api_keys` jadvalida (RLS orqali klientdan butunlay yopiq) saqlanadi va
faqat Edge Function (service-role) orqali o'qiladi.

**AI-ustoz endi quyidagi barcha joylarda ishlaydi:**
- 📖 Darslar (har bir oyning "Grammatika" va "Dialog" bosqichlarida)
- 📐 Grammatika sahifasi
- 🎧 Dialoglar sahifasi
- 📕 Kutubxona (yuklangan kitob/matnlar)

Har birida AI foydalanuvchiga o'sha mavzu bo'yicha shaxsiy vazifa beradi va
javobini tekshirib, fikr-mulohaza (feedback) qaytaradi.

---

## ☁️ Productionga chiqarish

- **Frontend** — Netlify yoki Vercel'ga oddiy statik React/Vite loyihasi
  sifatida deploy qilinadi (`npm run build` → `dist/` papkasi). Environment
  o'zgaruvchilarga (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) e'tibor bering.
- **Backend** — alohida hech narsa deploy qilish shart emas! Supabase allaqachon
  bulutda ishlaydi (Postgres + Auth + Edge Functions). Faqat yuqoridagi
  `supabase functions deploy` qadamini bajarganingizga ishonch hosil qiling.

## 🔐 Xavfsizlik haqida qisqacha

- Barcha jadvallarda **Row Level Security (RLS)** yoqilgan — foydalanuvchi
  faqat o'z progressini, hamma esa kutubxona/lug'atlarni o'qiy oladi, faqat
  admin/superadmin yoza oladi.
- `secure_settings` jadvaliga (Gemini kaliti saqlanadigan joy) **hech qanday**
  RLS siyosati yozilmagan — bu ataylab shunday, chunki policy yo'q = RLS uni
  klientdan butunlay yopib qo'yadi. Faqat Edge Function ichidagi
  `service_role` kaliti RLS'ni chetlab o'tadi.
- Admin yaratish/o'chirish va AI sozlamalarini o'zgartirish — bularning
  barchasi Edge Function ichida, so'rov yuborgan foydalanuvchining haqiqiy
  rolini **bazadan qayta tekshirib** (JWT'dagi eski ma'lumotga ishonmasdan)
  amalga oshiriladi.
