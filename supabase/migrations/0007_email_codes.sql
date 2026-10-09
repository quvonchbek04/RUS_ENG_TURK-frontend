-- ============================================================================
-- "Til sayohati" — Email tasdiqlash kodlari (6 xonali, 10 daqiqa)
-- 0006 dan KEYIN ishga tushiring (qayta ishga tushirish xavfsiz).
--
-- • Email bilan ro'yxatdan o'tganda, emailni almashtirganda va parolni
--   tiklaganda emailga 6 xonali kod yuboriladi (Edge Function "admin").
-- • Telefon bilan ro'yxatdan o'tishda kod so'ralmaydi.
-- • Kodning o'zi bazada saqlanmaydi — faqat HMAC-xesh (maxfiy kalit bilan).
-- • Jadvalga klientdan kirish butunlay yopiq (RLS yoqilgan, policy yo'q).
-- ============================================================================

create table if not exists public.email_codes (
  email text not null,
  purpose text not null check (purpose in ('register', 'reset', 'change-email')),
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (email, purpose)
);
create index if not exists email_codes_expires_idx on public.email_codes (expires_at);
alter table public.email_codes enable row level security;
-- Policy ataylab yozilmagan — faqat service-role (Edge Function) kira oladi.

-- Pochta xizmati sozlamalari (admin panel → "✉️ Email xizmati"). secure_settings klientdan yopiq.
insert into public.secure_settings (key, value) values
  ('mail_provider', 'brevo'),
  ('mail_api_key', ''),
  ('mail_from', ''),
  ('mail_from_name', 'Til sayohati')
on conflict (key) do nothing;
