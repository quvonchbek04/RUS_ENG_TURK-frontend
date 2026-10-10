# TEXNIK TOPSHIRIQ

**Loyiha:** «Til sayohati» — ingliz, rus va turk tillarini o'zbek tilida o'rganish veb-platformasi (2-versiya)
**Hujjat versiyasi:** 2.0 · **Sana:** 2026-yil oktabr
**Buyurtmachi:** Quvonchbek (super administrator)

---

## 1. Umumiy ma'lumot

### 1.1. Maqsad
O'zbek tilida so'zlashuvchi foydalanuvchilarga ingliz, rus va turk tillarini A1 darajadan C1 darajagacha
bosqichma-bosqich o'rgatadigan, telefonda qulay ishlaydigan, sun'iy intellekt (AI) ustoz bilan
jihozlangan veb-platforma yaratish.

### 1.2. Vazifalar
1. Mavjud darsliklarni Word fayllardagi ma'lumotlar (2161 so'z, 297 ibora — gap va tarjimalari bilan)
   asosida boyitish va ularni rus hamda turk tillariga tarjima qilib, uchala kursga qo'shish.
2. Ro'yxatdan o'tishni telefon raqami yoki email orqali amalga oshirish.
3. Avtomatik yaratiladigan super admin (login `quvonchbek`, parol `admin123`).
4. Super admin tomonidan foydalanuvchi va admin qo'shish/o'chirish.
5. Musiqa, video, rasm, matn, dialog, lug'at va yangiliklarni yuklash; chap menyuda alohida bo'limlar;
   bo'limga kirilganda yuklanganlar ketma-ketlikda ochilishi.
6. Lug'at mashqini kuchaytirish: istalgan payt to'xtatish va xatolarni alohida «Natija» bo'limida ko'rsatish.
7. AI ustozni takomillashtirish va API kalitlarni admin panelda to'liq boshqarish.
8. Dars o'rganish strukturasini qulay qilish, dizaynni yaxshilash, mobil moslashuvchanlik.
9. GitHub + Netlify + Supabase orqali ishga tushirishga tayyor arxiv.

### 1.3. Foydalanuvchilar
| Rol | Tavsif |
|---|---|
| Mehmon | Faqat kirish/ro'yxatdan o'tish sahifalarini ko'radi |
| O'quvchi (`user`) | Darslar, mashqlar, materiallar, AI ustoz, o'z natijalari |
| Admin (`admin`) | O'quvchi imkoniyatlari + **faqat super admin bergan ruxsatlar doirasida**: material yuklash, tahrirlash, o'chirish va tartiblash (bo'limlar bo'yicha: yangilik, musiqa, video, dialog, lug'at, matn, rasm) va funksiyalar — **o'quvchilarni** ko'rish / qo'shish / bloklash / parolini tiklash / o'chirish, AI va API kalitlarni ko'rish, Email xizmati holatini ko'rish, statistikani ko'rish. Ruxsatsiz narsani ko'rmaydi va bajara olmaydi. **Adminlar va super admin ma'lumotlarini ko'rmaydi** (hech qanday ruxsat bilan ham); adminlarni boshqara olmaydi, rol bera olmaydi, sozlamalarni o'zgartira olmaydi. Berilgan ruxsatlarini profilidagi «🔐 Mening ruxsatlarim» bo'limida ko'radi |
| Super admin (`superadmin`) | Hamma imkoniyat: **foydalanuvchilar va adminlar** (ro'yxat, qo'shish/o'chirish, bloklash, parolni tiklash, admin tayinlash); **adminlarning ruxsatlarini (yuklash va funksiyalar) belgilash**; ro'yxatdan o'tish usullari, email kodi va Telegram bot; AI sozlamalari, API kalitlar va Email xizmati. Uning ma'lumotlari boshqa hech kimga ko'rinmaydi |

---

## 2. Texnologiyalar va arxitektura

| Qatlam | Texnologiya |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4 (SPA, PWA manifest) |
| Backend | Supabase: PostgreSQL + Row Level Security, Supabase Auth, Supabase Storage, Edge Functions (Deno) |
| AI | Google Gemini, OpenAI, Groq, OpenRouter, DeepSeek yoki istalgan OpenAI-mos API (admin tanlaydi) |
| Hosting | Netlify (frontend), Supabase Cloud (backend), GitHub (kod, ixtiyoriy CI) |
| Ovoz | Brauzerning Web Speech API'si: matnni o'qish (TTS) va ovoz bilan yozish (speech recognition) |

```
 Brauzer / telefon (React SPA, Netlify)
   │  statik kontent: /content/meta.json, en.json, ru.json, tr.json
   │
   ├── Supabase Auth ........ kirish, sessiya (hisoblar `admin` funksiyasi orqali yaratiladi)
   ├── Supabase Postgres .... profiles, progress, media_items, settings, ai_usage, email_codes (RLS bilan)
   ├── Supabase Storage ..... "media" bucket (audio, video, rasm)
   └── Edge Functions
         ├── admin ......... ro'yxatdan o'tish + email kodlari, Telegram bot (webhook), kirish, foydalanuvchilar
         │                   (super admin / ruxsati bor admin), rollar va ruxsatlar, AI sozlamalari, API kalitlar, Email xizmati
         │                     ├──> Brevo / Resend (HTTP API) — tasdiqlash kodlarini yuboradi
         │                     └──> Telegram Bot API — kodlar va ro'yxatdan o'tish (bepul)
         └── ai ............ AI ustoz: vazifa, tekshiruv, chat, tushuntirish, kalitni sinash
                               └──> Gemini / OpenAI / Groq / OpenRouter / DeepSeek
```

Kurs kontenti (darslar, lug'at banki) statik JSON fayllar sifatida beriladi — bu bazani yuklamaydi va
sahifalarni tez ochadi. Foydalanuvchi progressi bitta `progress.state` (jsonb) maydonida saqlanadi.

---

## 3. Funksional talablar

### 3.1. Ro'yxatdan o'tish va kirish
| № | Talab |
|---|---|
| F-1.1 | Ro'yxatdan o'tish formasida **email va telefon raqami bir vaqtda** kiritiladi (kamida bittasi majburiy, ikkalasi ham mumkin). Boshqa maydonlar: ism, parol (≥ 6 belgi), parolni takrorlash |
| F-1.1a | **Email kiritilgan bo'lsa** (email yoki email + telefon) va email kodi talabi **yoqilgan** bo'lsa (standart): hisob ochilishidan oldin emailga **6 xonali tasdiqlash kodi** yuboriladi; foydalanuvchi kodni kiritgandan keyingina hisob yaratiladi. Kod 10 daqiqa amal qiladi, 5 marta noto'g'ri kiritish mumkin, qayta yuborish 60 soniyadan keyin |
| F-1.1e | **Super admin email kodi talabini yoqadi yoki o'chiradi** (Admin panel → ✉️ Email xizmati → «Ro'yxatdan o'tishda email tasdiqlash»). **Kodsiz** rejimda email tasdiqlanmasdan saqlanadi, kod so'ralmaydi va Email xizmati shart emas; forma (ro'yxatdan o'tish va profilda emailni almashtirish) sozlamaga qarab o'zi moslashadi. Sozlama `secure_settings.signup_email_code` (`on`/`off`) da saqlanadi, formaga ochiq `signup-config` amali orqali yetkaziladi. Telefon uchun kod har doim so'ralmaydi; parolni tiklash kodi har doim talab qilinadi |
| F-1.1b | **Faqat telefon kiritilgan bo'lsa**: tasdiqlash kodi **talab qilinmaydi** (SMS yuborilmaydi) — hisob darhol ochiladi |
| F-1.1c | Kodni **server o'zi avtomatik** yaratadi (kriptografik tasodifiy raqam) va yuboradi — admin yoki AI ishtiroki shart emas, admin tizimda bo'lmasa ham 24 soat ishlaydi. Kod bazada faqat HMAC-xesh ko'rinishida saqlanadi. Himoya: bitta IP dan soatiga ≤ 15 ta kod so'rovi, bitta emailga soatiga ≤ 5 ta kod; ro'yxatdan o'tish va parol tiklash urinishlari IP bo'yicha soatiga ≤ 20 |
| F-1.1d | Yuborish xizmati (Brevo yoki Resend, HTTP API) super admin tomonidan «✉️ Email xizmati» bo'limida bir marta sozlanadi; sozlanmaguncha email bilan ro'yxatdan o'tish o'chiq, telefon bilan esa ishlaydi. API kalit klientga chiqmaydi (faqat maskalangan ko'rinadi) |
| F-1.1f | **Ro'yxatdan o'tish usullarini super admin boshqaradi** (Admin panel → 🛡️ Ro'yxatdan o'tish): 👤 oddiy (ism + login + parol, tasdiqlashsiz), 📧 email (kod bilan yoki kodsiz), 📱 telefon (kodsiz yoki Telegram bot orqali tasdiqlash), ✈️ Telegram bot orqali (bepul, F-1.1i). Kamida bittasi yoqilgan bo'lishi shart. Forma faqat yoqilgan usullarni ko'rsatadi, server (`register`) yopiq usulni rad etadi (403). Super admin qo'shgan hisoblarga bu qoidalar ta'sir qilmaydi |
| F-1.1g | **Oddiy usul:** ism, login (lotin harflari, raqamlar, `_ . -`, 3–40 belgi, noyob; ismdan avtomatik taklif qilinadi) va parol. Email/telefon yo'q, shuning uchun parolni faqat super admin tiklaydi. Ichki email `<login>@til-sayohati.app` |
| F-1.1h | **Telegram orqali telefon tasdiqlash** (super admin yoqsa): foydalanuvchi raqamini kiritadi → sayt bir martalik token va bot havolasini beradi (10 daqiqa) → foydalanuvchi botda *Start* bosadi → bot «Raqamni ulashish» tugmasini beradi → bot ulashilgan kontakt **foydalanuvchining o'zinikini** (`contact.user_id = from.id`) va kiritilgan raqamga tengligini tekshiradi → bot 6 xonali kod yuboradi (foydalanuvchi tilida: uz/ru/en/tr) → kod saytga kiritiladi. Kod bazada faqat HMAC-xesh, 5 urinish, bir martalik. Bot token super admin panelida kiritiladi, webhook avtomatik o'rnatiladi va maxfiy sarlavha (`X-Telegram-Bot-Api-Secret-Token`) bilan himoyalanadi. Profilda telefonni almashtirish ham shu orqali tasdiqlanadi. Himoya: IP bo'yicha soatiga ≤ 15, raqam bo'yicha ≤ 6 so'rov |
| F-1.1i | **✈️ Telegram bot orqali ro'yxatdan o'tish (bepul; super admin yoqsa, bot ulangan bo'lishi shart):** ro'yxatdan o'tish sahifasining **pastida** «✈️ Telegram bot orqali ro'yxatdan o'tish (bepul)» tugmasi va «🤖 Telegram botga o'tish · @bot» havolasi turadi (telefon maydonida ham bot havolasi bor). Tugma `tg-start` (`purpose = register-tg`, raqam yuborilmaydi) orqali bir martalik token yaratadi va bot havolasini (`t.me/<bot>?start=<token>`) ochadi → foydalanuvchi botda *Start* va «Raqamni ulashish» ni bosadi → bot kontakt **foydalanuvchining o'zinikini** tekshirib, raqamni qabul qiladi (so'rov holati `verified`) → sayt `tg-status` ni har 2 soniyada so'rab turib buni sezadi (kod yozish shart emas) → foydalanuvchi ism va parol kiritadi → `register` (`tgToken`) hisobni ichki email `tel998XXXXXXXXX@til-sayohati.app` bilan yaratadi; keyin telefon raqami + parol bilan kiradi. So'rov 10 daqiqa amal qiladi, hisob ochilgach o'chiriladi; IP bo'yicha soatiga ≤ 20 so'rov |
| F-1.1j | **Raqam yozilganda kod Telegramga darhol keladi:** raqami botda avval tasdiqlangan foydalanuvchilar `tg_contacts` jadvalida saqlanadi (telefon → chat). Telefon Telegram orqali tasdiqlanadigan oqimda (ro'yxatdan o'tish, profilda raqamni almashtirish) raqam yuborilishi bilan server kodni shu chatga **darhol** yuboradi (`tg-start` javobi: `direct: true`) — botni qayta ochish shart emas. Raqam hali bog'lanmagan bo'lsa yoki bot bloklangan bo'lsa — oddiy oqim (bot havolasi). **Telegram cheklovi:** bot foydalanuvchiga birinchi bo'lib yoza olmaydi, shuning uchun har bir foydalanuvchi botni kamida bir marta ochishi shart (pullik Telegram Gateway ishlatilmagan) |
| F-1.2 | Telefon raqami normallashtiriladi (9 xonali raqamga `998` qo'shiladi, `+998XXXXXXXXX` ko'rinishida saqlanadi). Bitta raqam faqat bitta hisobga biriktiriladi (band bo'lsa formada darhol aytiladi). Faqat telefon kiritilgan bo'lsa, ichki email `tel998XXXXXXXXX@til-sayohati.app` yaratiladi |
| F-1.3 | Kirish bitta maydon orqali: **email, telefon raqami yoki login — qaysi biri qulay bo'lsa**. Email bilan ochilgan hisobga telefon/login bilan kirilganda, server (`admin` funksiyasi, `login` amali) telefon/login bo'yicha emailni topadi va kirishni o'zi bajaradi — emaillar klientga oshkor bo'lmaydi |
| F-1.3a | Profil sahifasida foydalanuvchi email va telefonni keyin ham qo'shishi yoki almashtirishi mumkin (kamida bitta kirish usuli qolishi shart). Email qo'shish/almashtirish ham emailga yuborilgan kod bilan tasdiqlanadi; telefon kodsiz |
| F-1.3b | Bitta login/email/telefon uchun 15 daqiqada 10 marta noto'g'ri parol kiritilsa, 15 daqiqaga vaqtincha qulflanadi |
| F-1.4 | «Meni eslab qol» — belgilansa sessiya brauzer yopilganda ham saqlanadi |
| F-1.5 | Emaili bor foydalanuvchilar uchun parolni tiklash: `/reset-password` sahifasida email kiritiladi → emailga 6 xonali kod keladi → kod va yangi parol kiritiladi (havola emas, kod). Faqat telefon bilan ochilgan hisobda email yo'q — parolni super admin tiklaydi |
| F-1.5a | **Parolni Telegram orqali tiklash** (bot ulangan bo'lsa): `/reset-password` sahifasida «✈️ Telegram» tanlanadi → telefon raqami kiritiladi → `tg-reset-start` raqam botda tasdiqlangan bo'lsa kodni Telegram chatiga yuboradi (aks holda umumiy xato — hisob mavjudligi oshkor qilinmaydi) → kod va yangi parol → `reset-with-code` (`tgToken`, `phone`). Kod 10 daqiqa, 5 urinish, bir martalik; IP bo'yicha soatiga ≤ 15, raqam bo'yicha ≤ 5 so'rov |
| F-1.6 | Bloklangan foydalanuvchi tizimga kira olmaydi |
| F-1.7 | Yangi foydalanuvchining roli doim `user` (rol ro'yxatdan o'tish ma'lumotidan olinmaydi) |
| F-1.8 | Super admin `quvonchbek / admin123` SQL o'rnatish vaqtida avtomatik yaratiladi; qayta o'rnatishda o'chirilmaydi, paroli o'zgartirilmaydi |

### 3.2. Kurs va dars tuzilmasi
| № | Talab |
|---|---|
| F-2.1 | Har bir til uchun 5 bosqich (Poydevor, Erkinlikka qadam, Amaliy muloqot, Mukammallashtirish, Qo'shimcha qo'llanma), jami 33 dars |
| F-2.2 | Darslar xaritasi: bosqichlar bo'yicha guruhlangan kartochkalar, har birida holat (yakunlangan / joriy / qulflangan), progress |
| F-2.3 | Dars ichida 7 bosqichli stepper: Grammatika → Lug'at → Dialog → Mashqlar → Javoblar → O'qituvchi tavsiyasi → Test |
| F-2.4 | Bosqichlar ketma-ket ochiladi; «✓ …, keyingisi →» tugmasi bosqichni bajarilgan deb belgilaydi. Telefonda tugma ekran pastida yopishib turadi |
| F-2.5 | Dars testi (aralash savollar, ≥ 60%) topshirilgach va barcha bosqichlar bajarilgach dars yakunlanadi va keyingi dars ochiladi |
| F-2.6 | Adminlar uchun barcha darslar ochiq |
| F-2.7 | Lug'at bosqichida: ro'yxat, aylanuvchi kartochkalar (swipe), Word fayldagi so'z va iboralar (qidiruv, tarjimani yashirish, talaffuz) |
| F-2.8 | Mashqlar bosqichida har bir javobni AI tekshirishi mumkin |
| F-2.9 | Darsga admin biriktirgan materiallar (audio, video, matn…) dars sahifasida ko'rsatiladi |
| F-2.10 | Dialog bosqichida: asosiy dialog, **ikkinchi dialog** va **o'qish matni** (tarjimasi va 3 ta tushunish savoli bilan) — ingliz, rus va turk kurslarining barcha 33 darsida. Ingliz tiliga xos joylar (masalan «ingliz tili kursi», ingliz sinonimlari) rus va turk tiliga moslashtirilgan |
| F-2.11 | Har bir dialogda: «▶ Butun dialogni tinglash» va **«🎭 Rolli o'qish»**: o'quvchi rolni tanlaydi; ilova suhbatdoshning gaplarini ovoz chiqarib o'qiydi; o'quvchi o'z gapini mikrofonga aytadi, nutq aniqlanib asl matn bilan solishtiriladi va 0–100% baho beriladi; «Namuna», «Qayta aytish», «Keyingisi», yakunda o'rtacha ball va «boshqa rolda o'qish». Mikrofon qo'llab-quvvatlanmasa — ovoz chiqarib o'qib, «Keyingisi» bilan davom etiladi |

### 3.3. Word fayllardagi ma'lumotlar
| № | Talab |
|---|---|
| F-3.1 | «Inglizcha_2161_soz.docx» (24 bo'lim, 2161 so'z) va «297_ibora_jadval.docx» (20 bo'lim, 297 ibora) ma'lumotlari: so'z/ibora, o'zbekcha tarjima, misol gap, gap tarjimasi |
| F-3.2 | Ma'lumotlar rus va turk tillariga tarjima qilingan (`data-src/i18n/`): rus/turk so'zi + rus/turk misol gapi; o'zbekcha tarjimalar umumiy |
| F-3.3 | Har bir so'z/ibora aynan bitta darsga mavzuga mos holda biriktiriladi (uchala tilda bir xil taqsimot) |
| F-3.4 | Rus so'zlari yonida lotin harflarida o'qilishi avtomatik ko'rsatiladi |
| F-3.5 | Ingliz artikllari (*the, a/an*) rus va turk tillarida ekvivalenti yo'qligi sababli bu tillarga qo'shilmaydi |
| F-3.6 | `node scripts/build-content.mjs` — manbadan kontent fayllarini qayta yig'adi va taqsimotni tekshiradi |

### 3.4. Lug'at (to'liq lug'at sahifasi)
| № | Talab |
|---|---|
| F-4.1 | Tablar: So'zlar (24 mavzu), Iboralar (20 mavzu), Kurs lug'ati (dars bo'yicha), Qo'shimcha (kategoriyalar + yuklangan lug'atlar) |
| F-4.2 | Qidiruv (so'z yoki tarjima), mavzu filtri, tarjimani yashirish rejimi, so'z va gapni tinglash |
| F-4.3 | Har bir so'z uchun «AI ustozdan tushuntirish» tugmasi |

### 3.5. Lug'at mashqi va «Natija»
| № | Talab |
|---|---|
| F-5.1 | Sozlash ekrani: **manba** (hamma so'zlar, kurs darslari, bitta dars, mavzu, iboralar, qo'shimcha/yuklangan lug'at, xatolarim), **savol turi** (so'z→ma'no, ma'no→so'z, yozish, tinglash, aralash), **soni** (10/20/30/50/100/barchasi) |
| F-5.2 | Mashq paytida: savol raqami, to'g'ri/xato hisoblagichlari, progress, javobdan keyin izoh (to'g'ri javob, misol gap), «O'tkazib yuborish», klaviatura (1–4, Enter), «to'g'ri bo'lsa avtomatik keyingisi» |
| F-5.3 | Yozish rejimida katta-kichik harf, tinish belgilari, `ё/е` farqi e'tiborga olinmaydi; ≥ 5 harfli so'zda bitta harf xatosi «kichik imlo xatosi» bilan to'g'ri hisoblanadi |
| F-5.4 | **«⏹ To'xtatish»** tugmasi istalgan payt mashqni tugatadi va **Natija** ekranini ochadi |
| F-5.5 | Natija ekrani: foiz (doira diagramma), to'g'ri/xato/javobsiz soni, vaqt; alohida tablar: **❌ Xatolar** (so'z, to'g'ri javob, foydalanuvchi javobi, savol turi, misol gap, talaffuz), **⏭ Javobsiz**, **✅ To'g'rilar** |
| F-5.6 | «🔁 Xatolar ustida ishlash» — faqat xato qilingan so'zlar bilan yangi mashq |
| F-5.7 | Har bir mashq tarixga yoziladi (oxirgi 40 ta); xato so'zlar «xatolar banki»ga tushadi va to'g'ri javob berilgan sari kamayadi |
| F-5.8 | «📊 Natijalar» sahifasi: tillar bo'yicha filtr, umumiy statistika, mashqlar tarixi (har birini ochib xatolarni ko'rish), xato qilingan so'zlar ro'yxati va ular bo'yicha mashq |
| F-5.9 | Dars testida to'xtatilsa, javob berilmagan savollar xato hisoblanadi (testni chetlab o'tishning oldi olinadi) |

### 3.6. Materiallar (yuklash va ko'rish)
| № | Talab |
|---|---|
| F-6.1 | Turlar: 🎵 musiqa/audio, 🎬 video, 🖼 rasm, 📄 matn, 💬 dialog, 📚 lug'at, 📰 yangilik. Har biri chap menyuda alohida bo'lim (soni bilan) |
| F-6.2 | Yuklash faqat super admin va ruxsat berilgan adminlar uchun (admin — faqat o'ziga ruxsat berilgan turlar bo'yicha, F-8.1c): til (yoki barcha tillar), sarlavha, tavsif, darsga biriktirish, nashr holati |
| F-6.3 | Audio, video, rasm — bir vaqtda bir nechta faylni yuklash (har biri ≤ 50 MB); sudrab tashlash (drag & drop) |
| F-6.4 | Matn — PDF/DOCX/TXT dan avtomatik ajratib olish yoki qo'lda kiritish |
| F-6.5 | Dialog — «A: Hello! \| Salom!» formatidagi matn (fayldan yoki qo'lda) + ixtiyoriy audio |
| F-6.6 | Lug'at — «so'z — tarjima» yoki «so'z ; talaffuz ; tarjima» formatida; yuklangan lug'at avtomatik lug'at mashqiga va to'liq lug'atga qo'shiladi |
| F-6.7 | Ketma-ketlik: elementlar admin belgilagan tartibda chiqadi (↑↓ tugmalari bilan o'zgartiriladi) |
| F-6.8 | Audio/video — pleylist: «ketma-ket ijro» (biri tugasa keyingisi avtomatik boshlanadi), oldingi/keyingi |
| F-6.9 | Rasm — galereya va katta ko'rinish; matn/dialog/lug'at — oynada ochiladi, «← Oldingi / Keyingisi →» bilan ketma-ket o'tish, «o'rganildi» belgisi |
| F-6.10 | Admin elementni tahrirlashi, yashirishi va o'chirishi mumkin (fayl Storage'dan ham o'chiriladi) |
| F-6.11 | Eng so'nggi yangiliklar bosh sahifada ko'rsatiladi |

### 3.7. AI ustoz
| № | Talab |
|---|---|
| F-7.1 | Chat paneli istalgan sahifadan ochiladi (desktop — suzuvchi tugma, telefon — pastki menyu, Ctrl/⌘+K); alohida «AI ustoz» sahifasi |
| F-7.2 | Joriy dars konteksti (mavzu, grammatika, so'zlar) avtomatik uzatiladi; o'chirib qo'yish mumkin |
| F-7.3 | Tezkor tugmalar: mavzuni tushuntirish, 5 ta test savoli, gapni tekshirish, so'z ma'nosi, suhbat mashqi, kunlik so'zlar |
| F-7.4 | Ovoz bilan yozish (o'rganilayotgan tilda) |
| F-7.5 | Javoblar o'zbek tilida, misollar tarjimasi bilan; administrator qo'shimcha ko'rsatma (uslub) bera oladi |
| F-7.6 | «AI vazifa» vidjeti: vazifa turi (avtomatik, tarjima, gap tuzish, bo'sh joy, savol-javob, grammatika), maslahat, namunaviy javob, baho 0–100, tuzatilgan variant, maslahatlar, takrorlanmaslik |
| F-7.7 | Kalit bo'lmasa «oddiy rejim»: shablon vazifalar, namunaga solishtirib tekshiruv, chatda lug'atdan so'z qidirish |
| F-7.8 | O'quvchi uchun kunlik so'rovlar limiti (standart 150, 0 = cheksiz); adminlarga cheklov yo'q |

### 3.8. Admin panel
| № | Talab |
|---|---|
| F-8.1 | **Statistika:** bugungi AI so'rovlar, faol kalitlar, materiallar, kurs kontenti jadvali (tillar bo'yicha); **faqat super adminga** qo'shimcha: foydalanuvchilar soni, shu hafta yangi, bugun faol, adminlar. Bo'lim faqat `stats_view` ruxsati bor adminga ochiq |
| F-8.0 | **Admin panel bosh ko'rinishi:** katta oynalar. Super admin uchun: **👥 Foydalanuvchilar** (jami, o'quvchilar, adminlar, bugun faol, shu hafta yangi), AI va API kalitlar, Ro'yxatdan o'tish; so'nggi ro'yxatdan o'tganlar; tezkor amallar. Oddiy admin uchun oynalar **ruxsatga qarab** chiqadi: Materiallar (doim), 👥 o'quvchilar (`users_view`), AI va API kalitlar (`ai_view`), Email xizmati (`mail_view`), statistika (`stats_view`); tepada «🔐 Mening ruxsatlarim» havolasi. Ruxsatsiz bo'lim yashiriladi va u uchun server so'rovi ham yuborilmaydi. Oyna bosilganda tegishli bo'lim ochiladi |
| F-8.1a | **«👥 Foydalanuvchilar» oynasi** chap menyuning «Boshqaruv» bo'limida alohida punkt sifatida turadi — super adminga va `users_view` ruxsati bor adminga (u faqat **o'quvchilarni** ko'radi; admin va super admin ro'yxatda yo'q). Ruxsatsiz adminga punkt ko'rinmaydi, `/admin?tab=users` havolasi esa «Umumiy» bo'limga qaytaradi |
| F-8.1c | **🔐 Ruxsatlar (faqat super admin):** barcha adminlar ro'yxati, har biri uchun **📤 Material yuklash** (7 ta bo'lim: yangilik, musiqa, video, dialog, lug'at, matn, rasm) va **⚙️ Funksiyalar** (8 ta: `users_view`, `users_add`, `users_block`, `users_reset`, `users_delete`, `ai_view`, `mail_view`, `stats_view` — tavsifi bilan) bo'yicha yoqish/o'chirish tugmalari, «Hammasi» / «Hech biri», saqlash holati; «🔒 Faqat super admin uchun» ro'yxati (hech kimga berilmaydigan imkoniyatlar). Ruxsat darhol kuchga kiradi. Yangi tayinlangan admin boshida hamma bo'limga yuklash va faqat ko'rish funksiyalarini (`ai_view`, `mail_view`, `stats_view`) oladi; o'quvchiga qaytarilganda ruxsatlar tozalanadi |
| F-8.1f | **🔐 Mening ruxsatlarim (admin profilida):** admin Profil sahifasining tepasida (va admin panelda havola orqali) o'z ruxsatlarini ko'radi: yuklash bo'limlari (✓/✕, «n/7 bo'lim»), funksiyalar (✓/✕ tavsifi bilan, «n/8 funksiya»), «🔒 Faqat super admin uchun (sizda yo'q)» ro'yxati va «↻ Yangilash» tugmasi (ruxsatlarni serverdan qayta yuklaydi; sahifa ochilganda ham avtomatik yangilanadi). Super admin uchun — «hamma narsaga ruxsat bor» ko'rinishi |
| F-8.1d | **Ruxsat bo'yicha ko'rinish:** admin faqat ruxsat berilgan bo'limlarda «+ Yuklash», tahrirlash, o'chirish va ↑↓ tugmalarini ko'radi; qolganlarida o'quvchi kabi faqat ko'radi (yashirin materiallar ham ko'rinmaydi). «Materiallar» bo'limida ruxsatsiz turlar «🔒 Faqat ko'rish» deb belgilanadi, tezkor amallar ham ruxsatga qarab chiqadi |
| F-8.1e | **🛡️ Ro'yxatdan o'tish (faqat super admin):** har bir usul (oddiy / email / telefon / ✈️ Telegram bot orqali bepul) uchun yoqish-o'chirish tugmasi (Telegram usuli bot ulanmaguncha yoqilmaydi; bot uzilganda o'chadi, boshqa usul qolmasa uzib bo'lmaydi); email uchun «kod bilan / kodsiz», telefon uchun «kodsiz / Telegram bot orqali tasdiqlash»; Telegram bot bo'limi (token kiritish, ulash, tekshirish, uzish, BotFather bo'yicha qadamlar). O'zgarishlar darhol kuchga kiradi |
| F-8.1b | **✉️ Email xizmati:** provayder (Brevo/Resend), API kalit (maskalangan), yuboruvchi email va nom, **test xat yuborish** tugmasi; holat belgisi (sozlangan/sozlanmagan). Saqlash va test — faqat super admin |
| F-8.2 | **Foydalanuvchilar ro'yxati:** kompyuterda jadval (foydalanuvchi, email/telefon, rol, ro'yxatdan o'tgan sana, oxirgi kirish, amallar), telefonda kartochkalar; qidiruv (ism, login, email, telefon); filtr (barchasi, o'quvchilar, adminlar, bloklanganlar); saralash (yangi, eski, ism, oxirgi kirish); «Yangilash»; qo'shish (login yoki email + ixtiyoriy telefon + parol + ism + rol); rol o'zgartirish (faqat super admin); parolni tiklash; bloklash/ochish; o'chirish; foydalanuvchi kartasi (kirish ma'lumotlari, XP, seriya, darslar, oxirgi mashqlar, bugungi AI) |
| F-8.3 | **Ruxsatlar: foydalanuvchilarni ko'rish va boshqarish sukut bo'yicha faqat super adminda.** Oddiy admin sukut bo'yicha ro'yxat, foydalanuvchi kartasi, email/telefon, progress va AI foydalanish hisobini ko'ra olmaydi, qo'sha/o'chira/bloklay olmaydi, parolni tiklay olmaydi. Super admin unga `users_view/add/block/reset/delete` ruxsatlarini bersa — admin **faqat `role = user` (o'quvchi) qatorlari** ustida shu amallarni bajara oladi; super admin va boshqa adminlar unga hech qachon ko'rinmaydi, ularni boshqara olmaydi (server «topilmadi» / 403 qaytaradi). Admin qo'sha oladigan rol — faqat `user`; rol berish, adminlarni boshqarish va ruxsat belgilash faqat super admin. Funksiya ruxsatlari `profiles.permissions` da saqlanadi va `admin` funksiyasida majburlanadi (self-edit trigger bilan bloklangan). Yana bir himoya: materialda yuklovchi login'i (`uploaded_by`) saqlanmaydi. Bu ikki qatlamda majburlanadi: (1) `admin` funksiyasi 403 qaytaradi; (2) Postgres RLS (`0008_users_super_only.sql`) — `profiles`, `progress`, `ai_usage` jadvallarini o'qish faqat egasi va super adminga ochiq, shuning uchun to'g'ridan-to'g'ri API so'rovi ham ma'lumot bermaydi. Super adminni o'chirish/bloklash mumkin emas; o'zini o'chirish mumkin emas |
| F-8.4 | **AI va API kalitlar:** provayder rejimi (avtomatik / aniq provayder / o'chiq), Gemini modeli, kunlik limit, ustoz uslubi; kalitlar ro'yxati (maskalangan, model, navbat, muvaffaqiyat/xato soni, oxirgi xato); qo'shish (provayder, nom, kalit, model, Base URL, navbat); **sinash** (javob vaqti va namuna); yoqish/o'chirish; tahrirlash; o'chirish |
| F-8.5 | Kalitlar rotatsiyasi: biri xato bersa keyingisi ishlatiladi; yaroqsiz kalit (401/403) 3 marta ketma-ket xato bersa avtomatik o'chiriladi; limit (429) xatosida o'chirilmaydi |
| F-8.6 | **Materiallar:** barcha bo'limlarga tezkor o'tish va sonlari |

### 3.9. Profil va motivatsiya
| № | Talab |
|---|---|
| F-9.1 | Profil: ismni o'zgartirish, parolni o'zgartirish, har bir til uchun ovoz va tezlik, mavzu (kunduzgi/tungi), «tizimda qolish» |
| F-9.2 | XP: to'g'ri javob +1, dars bosqichi +10, dars yakuni +20, AI vazifa +5; kunlik maqsad 30 XP |
| F-9.3 | Kunlik seriya (streak) va 7 kunlik faollik grafigi bosh sahifada |

---

## 4. Nofunksional talablar

| № | Talab |
|---|---|
| N-1 | **Mobil moslashuv:** 360 px kenglikdan boshlab; telefonda pastki navigatsiya (Asosiy, Darslar, Mashq, AI ustoz, Menyu), chiquvchi yon menyu, katta bosish maydonlari (≥ 40 px), iOS'da kirish maydonida kattalashmaslik, `safe-area` qo'llab-quvvatlash |
| N-2 | **PWA:** manifest va ikonkalar — telefon bosh ekraniga ilova sifatida qo'shish |
| N-3 | **Tezlik:** sahifalar alohida yuklanadi (code splitting); kurs kontenti tilga qarab alohida faylda; PDF/DOCX kutubxonalari faqat yuklashda yuklanadi; statik fayllar keshlash sarlavhalari bilan |
| N-4 | **Xavfsizlik:** barcha jadvallarda RLS; API kalitlar klientga chiqmaydi; rolni va yuklash ruxsatlarini o'zgartirish trigger bilan himoyalangan (foydalanuvchi o'z ruxsatini o'zi o'zgartira olmaydi); Edge Function'lar har so'rovda foydalanuvchini va rolini bazadan tekshiradi; `media_items` va Storage'ga yozish `can_upload(tur)` funksiyasi orqali faqat ruxsat berilgan turlar uchun (Storage yo'lining birinchi papkasi — tur) |
| N-5 | **Barqarorlik:** Supabase sekin javob bersa ham darslar 3,5 soniyada statik kontent bilan ochiladi; tarmoq xatolari tushunarli o'zbekcha xabar bilan ko'rsatiladi; progress sahifa yopilganda ham saqlanadi |
| N-6 | **Interfeys tili — 4 tilda:** o'zbek, rus, ingliz, turk. Til tanlagich kirish sahifasi tepasida, chap menyuda va Profil → Sozlamalarda; tanlov brauzerda saqlanadi, sahifa qayta yuklanmaydi. Menyular, tugmalar, xabarlar (jumladan serverdan kelgan xatolar), sana formatlari va **AI ustoz javoblari** tanlangan tilda. Dars materiallaridagi tushuntirishlar (grammatika matnlari, o'zbekcha tarjimalar) o'zbek tilida qoladi. Tarjimalar rontend/src/i18n/dict/*.js da (qatorlar: [uz, ru, en, tr]), 
ode scripts/check-i18n.mjs — yetishmayotgan/takror kalitlarni tekshiradi |
| N-7 | **Mavzu:** kunduzgi va tungi rejim (tizim sozlamasiga moslashadi) |
| N-8 | **Brauzerlar:** Chrome, Edge, Safari, Firefox, Samsung Internet — so'nggi 2 versiya |
| N-9 | **Qulaylik:** klaviatura bilan boshqaruv, fokus halqasi, `prefers-reduced-motion` hurmat qilinadi |

---

## 5. Ma'lumotlar modeli (Supabase Postgres)

| Jadval | Asosiy ustunlar | Kirish (RLS) |
|---|---|---|
| `profiles` | id, username, display_name, role (user/admin/superadmin), email, phone, is_blocked, **upload_kinds (text[] — adminga ruxsat berilgan material turlari)**, **permissions (text[] — adminga berilgan funksiya ruxsatlari: users_view, users_add, users_block, users_reset, users_delete, ai_view, mail_view, stats_view; CHECK bilan cheklangan)**, last_seen_at, created_at | **o'zi va super admin** o'qiydi (oddiy admin — yo'q); o'zi faqat ismini o'zgartiradi |
| `progress` | user_id, state (jsonb), updated_at | o'zi o'qiydi/yozadi; super admin o'qiydi |
| `media_items` | id, kind, lang, title, description, storage_path, file_url, mime, size_bytes, content (jsonb), lesson_ref, position, is_published, uploaded_by, created_at | kirgan foydalanuvchilar nashr qilinganlarni o'qiydi; yozish (qo'shish/tahrirlash/o'chirish) — faqat `can_upload(kind)` rost bo'lganda: super admin hamma tur, admin — `upload_kinds` ichidagi turlar |
| `settings` | key, value (ai_provider, ai_model_gemini, ai_daily_limit, ai_tutor_style) | kirganlar o'qiydi; super admin/Edge Function yozadi |
| `api_keys` | id, provider, label, key_value, base_url, model, priority, is_active, failure_count, success_count, last_used_at, last_error | klientdan butunlay yopiq (faqat service-role) |
| `ai_usage` | user_id, day, count | o'zi va super admin o'qiydi; yozish faqat `bump_ai_usage()` orqali |
| `login_attempts` | key (login/email/telefon/IP…), fails, window_start, locked_until | klientdan butunlay yopiq (kirish va kod yuborish cheklovlari uchun ham ishlatiladi) |
| `email_codes` | email, purpose (register/reset/change-email), code_hash, attempts, expires_at, created_at; kalit (email, purpose) | klientdan butunlay yopiq (RLS yoqilgan, siyosat yo'q) |
| `tg_verifications` | token, phone (`register-tg` da kontakt ulashilguncha bo'sh), purpose (register / phone-change / register-tg / reset), user_id, tg_user_id, chat_id, status (pending / await_contact / code_sent / verified), code_hash, attempts, expires_at | klientdan butunlay yopiq (RLS yoqilgan, siyosat yo'q) |
| `tg_contacts` | phone (PK, faqat raqamlar), tg_user_id, chat_id, lang, updated_at — botda raqamini tasdiqlagan foydalanuvchilar (kod darhol shu chatga yuboriladi) | klientdan butunlay yopiq (RLS yoqilgan, siyosat yo'q) |
| `secure_settings` | key, value (mail_provider, mail_api_key, mail_from, mail_from_name, signup_email_code, reg_login, reg_email, reg_phone, reg_telegram, signup_phone_telegram = on/off; tg_bot_token, tg_bot_username, tg_webhook_secret) | klientdan butunlay yopiq; faqat Edge Function (service-role) |

`profiles.phone` — noyob (unique index). `phone_available(p_phone)` — ro'yxatdan o'tish formasi uchun ochiq funksiya.
| `books`, `vocab_sets` | (1-versiyadan) | o'qish uchun saqlanadi; ma'lumotlari `media_items` ga ko'chirilgan |

`progress.state` tarkibi: `reviewFlags` (dars bosqichlari), `testResults` (dars testlari), `practiceHistory`
(mashqlar tarixi), `mistakeBank` (xato so'zlar), `activity` (kunlik XP), `xpTotal`, `vocabStats`, `aiStats`,
`exerciseAnswers`, `mediaDone`, `voiceSettings`.

Storage: `media` bucket (ommaviy o'qish, yozish — adminlar), yo'l: `<tur>/<YYYY-MM>/<uuid>.<kengaytma>`.

---

## 6. API (Edge Functions)

Barcha so'rovlar: `POST /functions/v1/<nomi>`, sarlavha `Authorization: Bearer <sessiya tokeni>`, tana `{ "action": "...", ... }`.

**`admin`**
| action | Kim | Tavsif |
|---|---|---|
| `login` | **ochiq (tokensiz)** | `identifier` (email/telefon/login), `password` → `{session}`; urinishlar cheklovi bilan |
| `send-email-code` | **ochiq** | `email`, `purpose` (register / reset) → emailga 6 xonali kod; 60 s kutish, IP va email bo'yicha soatlik cheklov |
| `signup-config` | **ochiq** | → `{methods:{login,email,phone,telegram}, emailCode, phoneTelegram, tgBot, mailReady}` — ro'yxatdan o'tish formasi shunga moslashadi |
| `tg-start` | **ochiq** (`phone-change` — kirgan foydalanuvchi) | `phone`, `purpose` (register / phone-change) → `{token, link}` yoki raqam botda avval tasdiqlangan bo'lsa `{direct: true, token, link}` (kod Telegramga darhol yuborilgan); `purpose = register-tg` (raqamsiz) → `{token, link}` — bot orqali ro'yxatdan o'tish; IP va raqam bo'yicha cheklov |
| `tg-status` | **ochiq** | `token` → `{status: pending / await_contact / verified / expired, phone (maskalangan, faqat verified)}` — sayt bot kontaktni qabul qilganini so'rab turadi |
| `tg-reset-start` | **ochiq** | `phone` → `{token}` — parolni tiklash kodi raqam bog'langan Telegram chatiga yuboriladi; raqam bog'lanmagan / hisob yo'q bo'lsa umumiy xato |
| `get-signup-settings` | super admin | usullar, email kodi, Telegram holati (token maskalangan) |
| `tg-save-bot` | super admin | `token` — botni ulaydi (getMe + setWebhook); bo'sh token — botni uzadi |
| `tg-check` | super admin | bot va webhook holati (`getMe`, `getWebhookInfo`) |
| `register` | **ochiq** | `email?`, `phone?`, `username?` (oddiy usul), `password`, `displayName`, `code?`, `tgToken?`, `tgCode?` — email bo'lsa va kod talabi yoqilgan bo'lsa `code` majburiy; faqat telefon bo'lsa yoki kod talabi o'chirilgan bo'lsa kodsiz; faqat `tgToken` (email, telefon va login yo'q) — Telegram bot orqali ro'yxatdan o'tish: so'rov `verified` bo'lishi shart, raqam so'rovdan olinadi; hisobni server yaratadi |
| `reset-with-code` | **ochiq** | `email`, `code`, `password` — parolni email kodi bilan tiklash; yoki `phone`, `tgToken`, `code`, `password` — Telegram kodi bilan |
| `update-my-contact` | har qanday kirgan foydalanuvchi | `email?` (+ `emailCode`, purpose `change-email`), `phone?` — o'z kirish ma'lumotlarini qo'shish/almashtirish |
| `stats` | super admin yoki `stats_view` | statistika; foydalanuvchi sonlari (`users`, `byRole`, `newThisWeek`, `activeToday`) faqat super adminga, oddiy adminda `null` |
| `list-users`, `user-detail` | super admin (hammani) yoki `users_view` (faqat `role = user`) | ro'yxat (oxirgi kirish bilan), foydalanuvchi kartasi; adminga admin/super admin qatorlari qaytarilmaydi |
| `create-user` | super admin yoki `users_add` | `identifier` (login/email/telefon), `phone?`, `password`, `displayName`, `role` (admin qo'shgan hisobga kod yuborilmaydi); `role = admin` / `create-admin` — faqat super admin, admin rolli hisobga standart ruxsatlar beriladi |
| `delete-user` | super admin yoki `users_delete` | o'chirish; admin — faqat o'quvchini; super adminning o'ziga qo'llanmaydi |
| `reset-password` | super admin yoki `users_reset` | yangi parol (admin — faqat o'quvchiga) |
| `block-user` | super admin yoki `users_block` | bloklash (`blocked`); admin — faqat o'quvchini |
| `set-role` | super admin | `role`: user / admin; `uploadKinds?`, `permissions?` (admin bo'lganda; berilmasa — avvalgilari yoki standart: hamma tur + ko'rish funksiyalari); o'quvchiga qaytarilganda ruxsatlar tozalanadi |
| `set-permissions` | super admin | `id`, `uploadKinds[]?` (audio, video, image, text, dialog, vocab, news) va/yoki `permissions[]?` (users_view, users_add, users_block, users_reset, users_delete, ai_view, mail_view, stats_view) — adminning ruxsatlari |
| `get-mail-settings` | super admin yoki `mail_view` | Email xizmati holati (kalit maskalangan) + `signupEmailCode` |
| `save-signup-settings` | super admin | `login`, `email`, `phone`, `telegram`, `emailCode`, `phoneTelegram` (true/false) — faqat berilganlari o'zgaradi; kamida bitta usul yoqilgan bo'lishi shart; Telegram usullari bot ulangan bo'lsagina yoqiladi |
| `save-mail-settings`, `test-mail` | super admin | `provider`, `apiKey`, `from`, `fromName`; test xat yuborish |
| `get-ai-settings` | super admin yoki `ai_view` | AI holati |
| `save-ai-settings` | super admin | `provider`, `geminiModel`, `dailyLimit`, `tutorStyle` |
| `list-api-keys` | super admin yoki `ai_view` | maskalangan ro'yxat |
| `add-api-key`, `update-api-key`, `toggle-api-key`, `delete-api-key` | super admin | kalitlarni boshqarish |

**`ai`**
| action | Tavsif |
|---|---|
| `status` | joriy provayder, faol kalitlar, kunlik limit va bugungi foydalanish |
| `task` | `type`, `content`, `lang`, `taskKind?`, `level?`, `avoid?` → `{question, hint, sample}` |
| `check` | `context`, `question`, `answer`, `lang`, `sample?` → `{correct, score, feedback, corrected, tips}` |
| `chat` | `messages[]`, `lang`, `context?` → `{reply}` |
| `explain` | `text`, `lang` → `{reply}` |
| `test-key` (faqat super admin) | `id` → `{ok, latencyMs, sample | error}` |

---

## 7. Interfeys (sahifalar)

| Yo'l | Sahifa |
|---|---|
| `/login`, `/register`, `/reset-password` | Kirish, ro'yxatdan o'tish (telefon/email), parolni tiklash |
| `/` | Bosh sahifa: salomlashish, kunlik maqsad, seriya, haftalik grafik, statistika, yo'nalishlar, tezkor amallar, yangiliklar, oxirgi natijalar |
| `/lang/:til` | Darslar xaritasi |
| `/lang/:til/month/:bosqich/:dars` | Dars (7 bosqichli stepper) |
| `/lang/:til/practice/:bosqich/:dars` | Dars testi |
| `/lang/:til/practice-full` | Lug'at mashqi (sozlash → mashq → natija) |
| `/lang/:til/dictionary`, `/dialogs`, `/grammar`, `/verbs` | Lug'at, dialoglar, grammatika, fe'llar |
| `/results` | Natijalar va xatolar |
| `/media/:tur` | Materiallar (audio, video, image, text, dialog, vocab, news) |
| `/ai` | AI ustoz |
| `/profile` | Profil va sozlamalar; adminlarda tepada «🔐 Mening ruxsatlarim» (`/profile#perms`) |
| `/admin` | Admin panel: Umumiy (oynalar) · `?tab=users` Foydalanuvchilar (super admin; adminga — `users_view` bilan, faqat o'quvchilar) · `?tab=perms` Ruxsatlar (**faqat super admin**) · `?tab=signup` Ro'yxatdan o'tish (**faqat super admin**) · `?tab=ai` AI va API kalitlar (`ai_view`) · `?tab=mail` Email xizmati (`mail_view`) · `?tab=content` Materiallar · `?tab=stats` Statistika (`stats_view`) |

Chap menyu bo'limlari: **Asosiy** (Bosh sahifa, Darslar, AI ustoz, Natijalar) · **Mashg'ulotlar** (Lug'at mashqi,
Lug'at, Dialog mashqi, Grammatika, Fe'llar) · **Materiallar** (Yangiliklar, Musiqa, Video, Dialoglar, Lug'atlar,
Matnlar, Rasmlar) · **Boshqaruv** (Admin panel; 👥 Foydalanuvchilar, 🔑 AI va API kalitlar — ruxsati bor adminga; 🔐 Mening ruxsatlarim — adminlarga; 🔐 Adminlar ruxsatlari va 🛡️ Ro'yxatdan o'tish — faqat super adminga). Yuqorida til tanlash (🇬🇧 🇷🇺 🇹🇷), pastda tungi rejim va profil.

---

## 8. Joylashtirish

Batafsil: `DEPLOY.md`. Qisqacha:
1. Supabase: `supabase/setup_full.sql` (0001…0011) → SQL Editor → Run; Auth'da «Confirm email» va
   «Allow new users to sign up» o'chiriladi (hisoblar faqat `admin` funksiyasi orqali ochiladi, shunda email kodini
   chetlab o'tib bo'lmaydi); `admin` va `ai` funksiyalari JWT tekshiruvisiz joylanadi.
2. GitHub: kod yuklanadi.
3. Netlify: repozitoriy ulanadi, `VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY` kiritiladi.
4. `quvonchbek / admin123` bilan kirib, parol almashtiriladi, AI kaliti qo'shiladi va «✉️ Email xizmati»
   (Brevo/Resend API kaliti + tasdiqlangan yuboruvchi email) sozlanib, test xat yuboriladi.

---

## 9. Qabul qilish mezonlari (test ssenariylari)

| № | Ssenariy | Kutilgan natija |
|---|---|---|
| T-1 | Email **va** telefon bilan birga ro'yxatdan o'tish; chiqish; avval email bilan, keyin telefon bilan, keyin login bilan kirish | Uchala usulda ham kirish muvaffaqiyatli; profilda email va telefon ko'rinadi |
| T-1a | Faqat telefon bilan ro'yxatdan o'tish, keyin profilda email qo'shish va email bilan kirish | Muvaffaqiyatli |
| T-1b | Band telefon raqami bilan ro'yxatdan o'tishga urinish | «Bu telefon raqami allaqachon ro'yxatdan o'tgan» |
| T-1c | Rus tili 1-oy darsi → Dialog → «🎭 Rolli o'qish» → «Men — Сара» | Administrator gaplari ovoz chiqarib o'qiladi, o'quvchi gapida mikrofon tugmasi va baho chiqadi |
| T-1d | Admin panel → «👥 Foydalanuvchilar» oynasini bosish (yoki chap menyudagi punkt) | Foydalanuvchilar ro'yxati (jadval) ochiladi; qidiruv, filtr va saralash ishlaydi |
| T-2 | Email bilan ro'yxatdan o'tish: forma → emailga kod keladi → kod kiritiladi → hisob ochiladi; keyin «Parolni unutdingizmi?» | Kod 1 daqiqa ichida keladi; noto'g'ri kod rad etiladi; tiklash kodi bilan yangi parol qo'yib kirish mumkin |
| T-2a | Faqat telefon bilan ro'yxatdan o'tish | Kod so'ralmaydi, hisob darhol ochiladi |
| T-2b | Email kodini 5 marta noto'g'ri kiritish; kod eskirgach (10 daqiqa) kiritish; 60 soniyadan oldin qayta yuborish | Har holatda tushunarli xato; yangi kod so'rash kerak |
| T-2c | Admin tizimda bo'lmagan (hech kim kirmagan) paytda email bilan ro'yxatdan o'tish | Kod baribir avtomatik keladi |
| T-2d | Super admin «Kodsiz» rejimni tanlaydi; so'ng email bilan ro'yxatdan o'tish | Forma «kod yuboriladi» belgisiz, tugma «Biletni olish»; hisob kodsiz ochiladi; «Kod bilan» qaytarilsa — yana kod so'raladi |
| T-4c | Super admin 🔐 Ruxsatlar bo'limida adminga faqat «Yangiliklar» va «Musiqa» ruxsatini beradi | O'sha admin shu ikki bo'limda «+ Yuklash» va tahrirlash tugmalarini ko'radi, Video/Dialog/… bo'limlarida yo'q; «Materiallar»da ular «🔒 Faqat ko'rish» |
| T-4d | Ruxsatsiz admin video yuklashga urinadi (to'g'ridan-to'g'ri API so'rovi, `media_items` yoki Storage `video/…`) | Baza rad etadi («row-level security»); ekranda «ruxsatingiz yo'q» xabari |
| T-4e | Admin o'z `profiles.upload_kinds` qiymatini REST orqali o'zgartirishga urinadi | O'zgarmaydi (trigger eski qiymatni qaytaradi) |
| T-2e | Super admin «Oddiy» usulni yoqadi; foydalanuvchi ism + login + parol bilan ro'yxatdan o'tadi va shu login bilan kiradi | Hisob kodsiz ochiladi; login ismdan avtomatik taklif qilinadi; band login rad etiladi |
| T-2f | Super admin faqat bitta usulni qoldiradi; yopilgan usul bilan `register` so'rovi yuboriladi | Forma faqat yoqilgan usulni ko'rsatadi; server 403 qaytaradi; oxirgi usulni o'chirib bo'lmaydi |
| T-2g | Telegram yoqilgan: telefon bilan ro'yxatdan o'tish (botni ochish → Start → Raqamni ulashish → kodni kiritish) | Kod botdan keladi; to'g'ri kod bilan hisob ochiladi; boshqa odamning kontaktini ulashish yoki boshqa raqam rad etiladi (bot xabari) |
| T-2h | Sayt tilini rus/ingliz/turk/o'zbekka almashtirish | Menyu, tugma, xabar va AI ustoz javobi tanlangan tilda; sahifa yangilangandan keyin ham saqlanadi |
| T-3 | `quvonchbek / admin123` bilan kirish | Admin panel ochiladi, roli «Super admin» |
| T-4 | Super admin admin qo'shadi va rol beradi | Muvaffaqiyatli; yangi admin materiallar yuklay oladi |
| T-4a | Ruxsatsiz (yangi) admin bilan kirish: chap menyu va admin panel | «👥 Foydalanuvchilar» punkti, oynasi, «so'nggi ro'yxatdan o'tganlar» va «foydalanuvchi qo'shish» **ko'rinmaydi**; AI, Email, Statistika faqat berilgan ko'rish ruxsatlariga qarab chiqadi; `/admin?tab=users` «Umumiy»ga qaytaradi |
| T-4b | Ruxsatsiz admin `admin` funksiyasiga `list-users` / `create-user` / `delete-user` / `block-user` yuboradi; `profiles` jadvalini REST orqali o'qiydi | Funksiya 403 «Bu amal uchun ruxsatingiz yo'q» qaytaradi; REST faqat o'z qatorini qaytaradi |
| T-4f | Super admin adminga faqat `users_view` va `users_reset` ruxsatini beradi; admin Foydalanuvchilar bo'limini ochadi | Faqat o'quvchilar ko'rinadi (admin va super admin ro'yxatda yo'q), har bir qatorda faqat 🔑 tugmasi; «+ Foydalanuvchi», ⛔, 🗑 yo'q; `block-user` / `delete-user` 403; admin yoki super admin `id` si bilan `user-detail` / `reset-password` — «topilmadi» |
| T-4g | Admin Profil sahifasini ochadi | «🔐 Mening ruxsatlarim»: yuklash bo'limlari va funksiyalar ✓/✕, «Faqat super admin uchun» ro'yxati; super admin ruxsatni o'zgartirgach «↻ Yangilash» yangi holatni ko'rsatadi |
| T-4h | Admin `profiles.permissions` ni REST orqali o'zgartirishga urinadi; super admin `set-permissions` bilan `permissions` beradi | Admin o'zgartira olmaydi (trigger eski qiymatni qaytaradi); super admin o'zgartirishi darhol kuchga kiradi |
| T-4i | Admin `create-user` orqali `role: admin` yaratishga yoki `set-role` / `set-permissions` / `get-signup-settings` ga urinadi | 403 (faqat super admin) |
| T-2i | Telegram bot orqali ro'yxatdan o'tish yoqilgan: sahifa pastidagi tugma → botda Start + Raqamni ulashish → saytga qaytish | Sayt o'zi «✅ Telegramda raqamingiz tasdiqlandi» ga o'tadi (kod yozilmaydi); ism + parol bilan hisob ochiladi; telefon raqami + parol bilan kirish ishlaydi; boshqa odamning kontakti rad etiladi |
| T-2j | Raqami botda avval tasdiqlangan foydalanuvchi telefon bilan ro'yxatdan o'tadi / profilda raqamni almashtiradi / parolni Telegram orqali tiklaydi | Raqam yuborilishi bilan kod Telegram chatiga darhol keladi («✈️ Kod Telegramga yuborildi»); bog'lanmagan raqamga — bot havolasi ko'rsatiladi |
| T-5 | O'quvchini bloklash | U kira olmaydi; blokdan chiqarilgach kiradi |
| T-6 | Gemini kalitini qo'shish → «Sinash» | ✅ «Ishlayapti (… ms)»; AI ustoz holati «AI faol» |
| T-7 | Kalitni noto'g'ri qiymat bilan qo'shish → sinash | ❌ aniq xato matni; kalit ishlatilmaydi |
| T-8 | Musiqa bo'limiga 3 ta mp3 yuklash, tartibini o'zgartirish | Pleylistda belgilangan tartib, ketma-ket ijro ishlaydi |
| T-9 | Lug'at fayli (DOCX) yuklash | Lug'atlar bo'limida va lug'at mashqi manbalarida paydo bo'ladi |
| T-10 | Lug'at mashqi: 20 savol, 5 tasiga javob berib «To'xtatish» | Natija: 5 ta javob bo'yicha foiz; xatolar alohida tabda, sizning javobingiz bilan; «Natijalar» sahifasida saqlangan |
| T-11 | «Xatolar ustida ishlash» | Faqat xato qilingan so'zlar bilan yangi mashq |
| T-12 | Rus tili 3-oy darsi → Lug'at bosqichi | Word fayldagi so'zlar rus tilida, lotin o'qilishi va misol gaplar bilan |
| T-13 | Turk tili lug'at sahifasi | 2159 so'z va 297 ibora, mavzular bo'yicha |
| T-14 | Telefonda (375 px) barcha sahifalar | Gorizontal aylantirish yo'q, pastki menyu ishlaydi, tugmalar qulay |
| T-15 | O'quvchi admin sahifasiga kiradi (`/admin`) | «Ruxsat yo'q» |

---

## 10. Cheklovlar va tavsiyalar

- **SMS orqali tasdiqlash** yo'q. Telefon raqami egaligi **Telegram bot orqali** tekshiriladi (super admin yoqsa; bepul,
  lekin foydalanuvchida Telegram bo'lishi va botni bir marta ochishi kerak). Yoqilmasa, telefon kodsiz ro'yxatdan o'tadi
  (egalik tekshirilmaydi). Kerak bo'lsa, SMS xizmati (Twilio, Eskiz.uz) yoki Telegram Gateway keyinroq qo'shilishi mumkin.
- **Oddiy usul** (ism + login + parol) tasdiqlashsiz — spamdan himoya faqat IP bo'yicha cheklov (soatiga ≤ 20). Ochiq
  ro'yxatdan o'tish kerak bo'lmasa, bu usulni panelda o'chirib qo'ying.
- **Sayt tili** faqat interfeysni qamrab oladi; dars matnlaridagi tushuntirishlar o'zbek tilida (so'z tarjimalari ham
  o'zbekcha). Boshqa tillarda tushuntirish kerak bo'lsa, kontent fayllari (`data-src`) alohida tarjima qilinishi kerak.
- **Email kodlari** uchinchi tomon xizmati orqali yuboriladi (Brevo bepul rejasi — kuniga 300 ta xat). Supabase Edge
  Functions SMTP portlarini bloklagani uchun faqat HTTP API (Brevo/Resend) ishlatiladi. Xizmat sozlanmasa, email bilan
  ro'yxatdan o'tish va parolni tiklash ishlamaydi.
- Telefon bilan ochilgan hisobda email yo'q, shuning uchun parolni «email kodi» bilan tiklab bo'lmaydi — super admin
  Foydalanuvchilar bo'limidan parolni tiklaydi yoki foydalanuvchi profilida email qo'shib oladi.
- Oddiy adminlar sukut bo'yicha foydalanuvchilarni ko'rmaydi (o'quvchi shaxsiy ma'lumotlarini himoyalash uchun); super admin kerakli
  adminga o'quvchilarni ko'rish/boshqarish ruxsatini bera oladi — u hamma o'quvchini ko'radi. Agar kelajakda o'qituvchilarga faqat
  o'z o'quvchilarining natijalarini ko'rsatish kerak bo'lsa, buning uchun alohida «guruh» tushunchasi qo'shiladi.
- **Telegram bot** foydalanuvchiga birinchi bo'lib yoza olmaydi: har bir foydalanuvchi botni kamida bir marta (sayt bergan havola orqali)
  ochishi shart; shundan keyin kodlar (ro'yxatdan o'tish, raqamni almashtirish, parolni tiklash) raqam yozilishi bilan Telegramga o'zi keladi.
  Telegram'ning pullik «Gateway» xizmati raqamga to'g'ridan-to'g'ri yozadi — hozir ishlatilmagan.
- Telegram orqali kelgan hisobda ham email yo'q (ichki email) — parolni «Telegram» usuli bilan tiklash mumkin (raqam botda tasdiqlangan bo'lgani uchun).
- Bepul Supabase rejasi: 500 MB baza, 1 GB fayl saqlash, har bir fayl ≤ 50 MB. Ko'p video uchun pullik reja
  yoki tashqi video xosting (YouTube havolasi) tavsiya etiladi.
- Matnni ovoz bilan o'qish sifati qurilmadagi ovozlarga bog'liq (Profil → Talaffuz ovozi).
- «Qo'shimcha grammatika» izohlari faqat ingliz kursida (ingliz grammatikasiga xos); rus va turk kurslarida
  asosiy grammatika bo'limi bor.
- Rolli o'qishdagi nutqni aniqlash brauzerga bog'liq (Chrome, Edge, Android'dagi Chrome va Safari'ning yangi
  versiyalari qo'llab-quvvatlaydi).
- Kelajak uchun: offline rejim (service worker), push-bildirishnomalar (kunlik eslatma), sertifikat generatsiyasi,
  guruhlar va o'qituvchi kabineti, reyting jadvali.
