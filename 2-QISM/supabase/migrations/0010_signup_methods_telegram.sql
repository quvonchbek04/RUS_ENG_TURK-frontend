-- ============================================================================
-- "Til sayohati" — Ro'yxatdan o'tish usullari va Telegram orqali tasdiqlash
-- 0009 dan KEYIN ishga tushiring (qayta ishga tushirish xavfsiz).
--
-- Super admin panelidan boshqariladi (Admin panel → 🛡️ Ro'yxatdan o'tish):
--   reg_login             — oddiy usul: ism + login + parol (tasdiqlashsiz)
--   reg_email             — email bilan (signup_email_code = on/off: kod bilan yoki kodsiz)
--   reg_phone             — telefon raqami bilan
--   signup_phone_telegram — telefon raqamini Telegram bot orqali tasdiqlash (on/off)
--   tg_bot_token / tg_bot_username / tg_webhook_secret — Telegram bot sozlamalari
-- secure_settings klientdan butunlay yopiq (faqat Edge Function / service-role).
-- ============================================================================

insert into public.secure_settings (key, value) values
  ('reg_login', 'on'),
  ('reg_email', 'on'),
  ('reg_phone', 'on'),
  ('signup_phone_telegram', 'off'),
  ('tg_bot_token', ''),
  ('tg_bot_username', ''),
  ('tg_webhook_secret', '')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Telegram orqali telefon tasdiqlash so'rovlari (10 daqiqa amal qiladi).
-- Oqim: sayt token yaratadi → foydalanuvchi bot havolasini ochadi (/start <token>) →
-- bot "Raqamni ulashish" tugmasini beradi → ulashilgan kontakt o'sha foydalanuvchiniki
-- va kiritilgan raqamga teng bo'lsa — bot 6 xonali kod yuboradi → kod saytga kiritiladi.
-- Kodning o'zi saqlanmaydi — faqat HMAC-xesh. Jadvalga klientdan kirish yopiq.
-- ---------------------------------------------------------------------------
create table if not exists public.tg_verifications (
  token text primary key,
  phone text not null,                       -- faqat raqamlar, masalan 998901234567
  purpose text not null default 'register' check (purpose in ('register', 'phone-change')),
  user_id uuid,                              -- phone-change uchun: kimning raqami
  tg_user_id bigint,                         -- botni ochgan Telegram foydalanuvchisi
  chat_id bigint,
  status text not null default 'pending' check (status in ('pending', 'await_contact', 'code_sent')),
  code_hash text,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists tg_verifications_phone_idx on public.tg_verifications (phone);
create index if not exists tg_verifications_tg_user_idx on public.tg_verifications (tg_user_id);
create index if not exists tg_verifications_expires_idx on public.tg_verifications (expires_at);
alter table public.tg_verifications enable row level security;
-- Policy ataylab yozilmagan — faqat service-role (Edge Function) kira oladi.
