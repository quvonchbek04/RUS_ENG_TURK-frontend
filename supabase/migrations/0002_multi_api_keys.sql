-- ============================================================================
-- "Til sayohati" — Bir nechta AI (Gemini) API kalitlarini qo'llab-quvvatlash
-- Bu faylni Supabase SQL Editor'da 0001_init.sql dan KEYIN ishga tushiring.
-- ============================================================================

-- Bir nechta Gemini API kalitini saqlash uchun jadval. Bitta kalit kunlik/
-- daqiqalik limitga (quota) tegib qolsa, tizim avtomatik keyingi faol kalitga
-- o'tadi — shu sababli bir nechta bepul kalit qo'shib, limitni "kengaytirish"
-- mumkin bo'ladi.
--
-- Eslatma: secure_settings jadvali kabi, bu yerga ham ATAYLAB hech qanday RLS
-- policy yozilmaydi — shu sababli klientdan (anon/authenticated) kirish
-- BUTUNLAY yopiq bo'ladi, faqat Edge Function (service-role) o'qiy/yoza oladi.
create table if not exists public.api_keys (
  id bigint generated always as identity primary key,
  provider text not null default 'gemini',
  label text,
  key_value text not null,
  is_active boolean not null default true,
  failure_count int not null default 0,
  last_used_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
-- Policy ataylab yozilmagan — to'liq yopiq, faqat service-role kira oladi.

-- Eski (yagona) kalit sozlamasidan (secure_settings.gemini_api_key) mavjud
-- qiymatni, agar bo'lsa, yangi jadvalga bir martalik ko'chirib qo'yamiz —
-- shunda avval saqlagan kalitingiz yo'qolib qolmaydi.
insert into public.api_keys (provider, label, key_value, is_active)
select 'gemini', 'Asosiy kalit (avvalgi sozlamadan ko''chirildi)', value, true
from public.secure_settings
where key = 'gemini_api_key' and value is not null and value <> ''
  and not exists (select 1 from public.api_keys where provider = 'gemini');
