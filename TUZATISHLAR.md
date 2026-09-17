# Tuzatilgan xatolar ro'yxati

Bu faylda loyihada topilgan va tuzatilgan xatolar keltirilgan. Har bir tuzatish
kod ichida ham izoh bilan belgilangan (`MUHIM TUZATISH:` deb qidiring).

Tekshiruv usuli: frontend `npm run build` bilan qurildi, `oxlint` ishlatildi,
migratsiyalar esa **haqiqiy PostgreSQL 16 bazasida** toza holatdan boshlab
0001 → 0002 → 0003 → 0004 tartibida ishga tushirilib sinovdan o'tkazildi
(RLS siyosatlari, trigger'lar va ruxsatlar amaliy tekshirildi).

---

## 🔴 Kirishni butunlay buzadigan xatolar

### 1. E'lektron pochta tasdiqlash yoqilgan holda hech kim kira olmasdi
**Qayerda:** Supabase loyiha sozlamalari + `supabase/config.toml`

Ilova login/parol asosida ishlaydi va ichkarida `login@til-sayohati.app`
ko'rinishidagi **sun'iy** email yaratadi. Bunday manzilga hech qanday xat
yetib bormaydi. Supabase'da esa "Confirm email" **standart holatda YOQILGAN**.
Natija: foydalanuvchi ro'yxatdan o'tadi, lekin hech qachon kira olmaydi va
hech qanday tushunarli xabar ham ko'rmaydi.

**Tuzatildi:**
- `README.md` ga majburiy "2.1-qadam" qo'shildi.
- `config.toml` da `enable_confirmations` noto'g'ri bo'limda (`[auth]`) edi —
  Supabase CLI uni u yerda **umuman o'qimaydi**. To'g'ri joyga (`[auth.email]`)
  ko'chirildi.
- `api.register()` endi sessiya qaytmaganini aniqlab, aniq yo'riqnoma beradi.
- `api.login()` "Email not confirmed" xatosini o'zbekcha tushuntiradi.

### 2. `.env` to'ldirilmaganda butunlay oq ekran
**Qayerda:** `frontend/src/lib/supabase.js`, `frontend/src/main.jsx`

`createClient(undefined, undefined)` modul yuklanishida istisno tashlaydi —
React umuman ishga tushmaydi. Foydalanuvchi sababni bilmagan holda bo'sh sahifa
ko'radi (xabar faqat konsolda).

**Tuzatildi:** sozlama tekshiriladi, xato bo'lsa qadam-baqadam yo'riqnoma bilan
ekran ko'rsatiladi. `sessionStorage` mavjud bo'lmagan muhitlar uchun ham zaxira
saqlagich qo'shildi.

### 3. Ilova "Yuklanmoqda…" holatida osilib qolishi
**Qayerda:** `frontend/src/context/AuthContext.jsx`

`supabase.auth.onAuthStateChange()` callback'i **ichida** boshqa `supabase.*`
chaqiruvlarini bajarish Supabase klientida ichki qulf (deadlock) hosil qiladi —
bu Supabase'ning ma'lum muammosi.

**Tuzatildi:** ish `setTimeout(..., 0)` orqali keyingi vazifaga ko'chirildi,
ortiqcha hodisalar (`INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`)
e'tiborsiz qoldiriladi.

### 4. Progress qatori yo'q foydalanuvchi umuman kira olmasdi
**Qayerda:** `frontend/src/lib/api.js`

`.single()` qator topilmasa **xato** qaytaradi (PGRST116). `getProgress()`,
`me()`, `login()`, `register()` — barchasi `.single()` ishlatardi, ya'ni
progress yoki profil qatori hali yaratilmagan bo'lsa kirish
"JSON object requested, multiple (or no) rows returned" bilan to'xtardi.

**Tuzatildi:** hamma joyda `.maybeSingle()` ga o'tkazildi + `publicProfile(null)`
endi qulamaydi. `0004_fixes.sql` esa mavjud, lekin profili/progressi yo'q
foydalanuvchilarni bir martalik tuzatib chiqadi.

### 5. Parol uzunligi mos emasdi
**Qayerda:** `api.js`, `Register.jsx`, `AdminPage.jsx`, `admin/index.ts`

Frontend 4 belgiga ruxsat berardi, Supabase Auth esa kamida 6 talab qiladi.
Foydalanuvchi tushunarsiz inglizcha xato olardi.

**Tuzatildi:** hamma joyda 6 ga keltirildi, login belgilariga tekshiruv qo'shildi.

---

## 🟠 Jimgina ishlamaydigan (eng xavfli turdagi) xatolar

### 6. AI sozlamalari saqlanmasdi, lekin "Saqlandi" deb ko'rsatardi
**Qayerda:** `supabase/functions/admin/index.ts`

`settings` jadvalini `update` bilan yangilardi. Agar `ai_provider` qatori
mavjud bo'lmasa, `update` hech narsa o'zgartirmaydi va **xato ham qaytarmaydi**.
Admin panel muvaffaqiyat xabarini ko'rsatar, aslida hech narsa saqlanmasdi.

**Tuzatildi:** `upsert` ga o'tkazildi + `0004_fixes.sql` kerakli qatorni
kafolatlaydi + `settings` uchun yetishmayotgan INSERT siyosati qo'shildi.

### 7. Kalitlarni avtomatik almashtirish mexanizmi ishlamasdi
**Qayerda:** `supabase/functions/ai/index.ts`

Kalit statistikasi (`failure_count`, `is_active`, `last_error`) `.then(() => {})`
bilan **kutilmasdan** yozilardi. Deno Edge Runtime javob qaytarilgach izolyatni
darhol to'xtatishi mumkin — natijada bu yozuvlar ko'pincha bazaga umuman yetib
bormasdi. Ya'ni admin panelda "xatolar soni" doim 0 ko'rinar va limitga tekkan
kalit hech qachon o'chmas edi — README'da va'da qilingan funksiya aslida
ishlamayotgan edi.

**Tuzatildi:** `await` ga o'tkazildi. Qo'shimcha:
- 401/403/"invalid api key" — kalit **darhol** o'chiriladi (u qayta urinishdan
  tuzalmaydi), kvota xatosi esa 5 marta takrorlangach.
- Gemini'ga 25 soniyalik timeout (avval javob bermasa funksiya osilib qolardi).
- Xavfsizlik filtri bloklagan va bo'sh javoblar endi xato deb tan olinadi —
  avval ular jimgina "mock" rejimiga tushirardi.

### 8. O'chirish soxta muvaffaqiyat ko'rsatardi
**Qayerda:** `frontend/src/lib/api.js`, `pages/Library.jsx`

RLS o'chirishga ruxsat bermasa, Postgres **xato qaytarmaydi** — shunchaki 0 ta
qator o'chadi. Interfeys kitobni ro'yxatdan olib tashlar, sahifa yangilangach
u qaytib chiqardi.

**Tuzatildi:** `.select('id')` qo'shilib, haqiqatan o'chganligi tekshiriladi;
xato endi foydalanuvchiga ko'rsatiladi (avval `catch {}` ichida yutilardi).

### 9. Saqlanmagan progress yo'qolardi
**Qayerda:** `frontend/src/context/AuthContext.jsx`

Har bir token yangilanishida (yoki oyna fokusga qaytganda) serverdan progress
qayta tortib olinib, hali saqlanmagan mahalliy o'zgarishlar ustiga yozilardi.
Bundan tashqari, chiqish yoki varaqni yopish paytida debounce ichidagi (0.5 s)
oxirgi o'zgarishlar umuman saqlanmasdi.

**Tuzatildi:** profil bir marta yuklanadi; chiqishda, varaq yopilganda va fon
rejimiga o'tganda saqlanmagan progress majburan yoziladi.

---

## 🟡 Baza (SQL) tuzatishlari — `0004_fixes.sql`

| Muammo | Tuzatish |
|---|---|
| `public.current_role()` Postgres'ning o'z `current_role` kalit so'zini soyalab qo'yardi — chalkash va xavfli | `public.app_role()` va `public.is_admin()` ga ajratildi |
| RLS siyosatlarida funksiya **har bir qator** uchun qayta chaqirilardi (sekinlik) | `(select public.is_admin())` shakliga o'tkazildi — bir marta hisoblanadi |
| `handle_new_user` trigger'i username to'qnashuvida butun ro'yxatdan o'tishni "Database error saving new user" bilan buzardi | Endi unikal qilib raqam qo'shadi (`aziz` → `aziz1`) va kutilmagan xato hisob yaratilishini to'xtatmaydi |
| `settings` jadvalida INSERT siyosati yo'q edi | Qo'shildi |
| `books`/`vocab_sets` uchun bitta umumiy `for all` siyosati | Alohida insert/update/delete siyosatlariga bo'lindi (aniqroq va tekshirish oson) |
| Indekslar yo'q — `lang` bo'yicha har bir filtr to'liq jadval skani | 6 ta indeks qo'shildi |
| `api_keys`/`secure_settings` ga klient uchun ortiqcha GRANT'lar | `revoke` qilindi — RLS ustiga qo'shimcha himoya qatlami |
| Profili yoki progressi yo'q eski foydalanuvchilar | Bir martalik avtomatik tuzatish qo'shildi |
| `lang` ustuniga cheklov yo'q | `check (lang in ('ru','en','tr'))` qo'shildi (`not valid` — mavjud ma'lumotni buzmaydi) |

---

## 🟢 Boshqa tuzatishlar

- **CORS:** `x-supabase-api-version` header'i ro'yxatda yo'q edi — supabase-js'ning
  yangi versiyalarida brauzer preflight'ni rad etib, "Failed to fetch" berardi.
- **Xato xabarlari:** RLS bloklashi, jadval yo'qligi, deploy qilinmagan Edge
  Function, tarmoq uzilishi — barchasi endi o'zbekcha, tushunarli matn bilan.
- **`words` null bo'lganda qulash:** Kutubxona va To'liq lug'at sahifalari
  himoyalandi.
- **Email formulasi ikki joyda takrorlangan edi** — `usernameToEmail()` ga
  birlashtirildi (bittasi o'zgarsa kirish buzilar edi).
- **`create-admin`:** rol berilmasa hisob "oddiy foydalanuvchi" bo'lib qolardi —
  endi bunday holatda hisob orqaga qaytariladi. O'z hisobini o'chirish bloklandi.
- **`add-api-key`:** bir xil kalitni ikki marta qo'shish endi ogohlantiriladi
  (aks holda "almashtirish" foyda bermaydi — ikkalasi bir vaqtda limitga tegadi).
- **`README.md`:** migratsiya tartibi jadvali va nosozliklarni bartaraf etish
  bo'limi qo'shildi.

---

## Ishga tushirish tartibi (qisqacha)

1. Supabase SQL Editor: `0001` → `0002` → `0003` → `0004` ni **tartib bilan** ishga tushiring.
2. Authentication → Email: **"Confirm email" ni o'chiring**.
3. `supabase functions deploy admin` va `supabase functions deploy ai`.
4. `frontend/.env` ni to'ldiring → `npm install` → `npm run dev`.
5. Ro'yxatdan o'ting, so'ng SQL'da:
   `update public.profiles set role = 'superadmin' where username = 'Quvonchbek';`

To'liq yo'riqnoma `README.md` da.
