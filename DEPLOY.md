# Ishga tushirish: Supabase + GitHub + Netlify

## 1. Supabase
1. supabase.com → **New project** (database parolini eslab qoling).
2. **SQL Editor** → `supabase/migrations/` ichidagi fayllarni TARTIB bilan ishga tushiring:
   `0001_init.sql` → `0002_multi_api_keys.sql` → `0003_security_fix_role_escalation.sql` → **`0004_seed_superadmin.sql`**
   (oxirgisi super admin **Quvonchbek / admin123** ni yaratadi).
3. **Authentication → Providers → Email**: "Confirm email" ni **o'chiring**.
4. **Edge Functions** → `ai` va `admin` funksiyalarini yarating, kodini `supabase/functions/ai/index.ts` va `admin/index.ts` dan joylang (yoki 5-bandni ko'ring).
5. **Project Settings → API** dan `Project URL` va `anon public` kalitni oling.

## 2. GitHub
```bash
git init && git add . && git commit -m "Til sayohati"
git branch -M main
git remote add origin https://github.com/<login>/<repo>.git
git push -u origin main
```
`.env` fayli `.gitignore` da — GitHub'ga chiqmaydi.

## 3. Netlify
1. Netlify → **Add new site → Import from Git** → repozitoriyni tanlang (`netlify.toml` hamma narsani o'zi sozlaydi).
2. **Site settings → Environment variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public kalit
3. **Deploy** (o'zgaruvchilarni qo'shgandan keyin qayta deploy qiling).

## 4. Birinchi kirish
Saytda login `Quvonchbek`, parol `admin123`. Kirgach **Admin panel** orqali admin va o'quvchi qo'shasiz.
⚠️ Parolni ishga tushgach Supabase → Authentication → Users orqali almashtiring.

## 5. (Ixtiyoriy) Funksiyalarni avtomatik yuklash
`.github/workflows/deploy-functions.yml` — GitHub Secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`) qo'shsangiz, `supabase/` o'zgarganda funksiyalarni o'zi yuklaydi.

## Kontentni yangilash
`python3 scripts/enrich_content.py` — `data-src/` dagi so'z/ibora/qo'shimchalardan `frontend/public/content.json` ni qayta yig'adi.
