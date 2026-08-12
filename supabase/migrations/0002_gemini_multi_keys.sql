-- ============================================================================
-- "Til sayohati" — Ko'p Gemini API kalitini qo'llab-quvvatlash
-- Bu faylni Supabase SQL Editor'da 0001_init.sql'dan KEYIN, bir marta
-- ishga tushiring.
-- ============================================================================

-- Bir nechta Gemini API kalitini bir vaqtning o'zida saqlash uchun.
-- Kalitlar Edge Function ichida tasodifiy tartibda sinaladi (yuklamani
-- taqsimlash) — biri limitga uchrasa (429), avtomatik keyingisiga o'tiladi.
create table if not exists public.secure_api_keys (
  id bigint generated always as identity primary key,
  provider text not null default 'gemini',
  api_key text not null,
  label text,
  created_at timestamptz not null default now()
);

alter table public.secure_api_keys enable row level security;
-- Eslatma: QASDDAN hech qanday policy yozilmaydi — secure_settings kabi,
-- shu sababli RLS uni klientdan (anon/authenticated) BUTUNLAY yopib qo'yadi.
-- Faqat Edge Function ichidagi service-role kalit RLS'ni chetlab o'tib o'qiy/yoza oladi.

-- Eski (bitta kalitli) sozlamada kalit saqlangan bo'lsa, uni avtomatik
-- yangi jadvalga ko'chiramiz — hech narsa yo'qolmaydi.
insert into public.secure_api_keys (provider, api_key, label)
select 'gemini', value, 'Asosiy kalit'
from public.secure_settings
where key = 'gemini_api_key' and value is not null and value <> ''
on conflict do nothing;
