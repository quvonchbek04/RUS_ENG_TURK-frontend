-- ============================================================================
-- "Til sayohati" — Adminlarning funksiya ruxsatlari + Telegram orqali ro'yxatdan o'tish
-- 0010 dan KEYIN ishga tushiring (qayta ishga tushirish xavfsiz).
--
-- 1) profiles.permissions (text[]) — super admin adminga beradigan funksiya ruxsatlari:
--      users_view, users_add, users_block, users_reset, users_delete  (faqat O'QUVCHILAR ustida)
--      ai_view, mail_view, stats_view                                  (ko'rish)
--    Yuklash ruxsatlari (upload_kinds) alohida, 0009 da. Super admin hamma narsaga ega;
--    adminlarni boshqarish, rol berish, sozlamalar — faqat super admin (ruxsat berib bo'lmaydi).
-- 2) tg_contacts — Telegram bot orqali raqamini tasdiqlagan foydalanuvchilar (telefon → chat).
--    Shu sababli raqam yozilganda kod Telegramga DARHOL yuboriladi (botni qayta ochish shart emas).
-- 3) tg_verifications — yangi maqsadlar: 'register-tg' (Telegram orqali ro'yxatdan o'tish,
--    raqam kontakt ulashilganda aniqlanadi) va 'reset' (parolni tiklash); yangi holat 'verified'.
-- 4) secure_settings.reg_telegram — Telegram orqali ro'yxatdan o'tish usuli (standart: o'chiq).
-- 5) media_items.uploaded_by — admin/super admin login'lari tozalanadi (ularning ma'lumotlari hech kimga ko'rinmasin).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Funksiya ruxsatlari. Faqat BIRINCHI marta qo'shilganda mavjud adminlarga
--    avvalgi xatti-harakat (ko'rish) saqlanadi; qayta ishga tushirishda o'zgarmaydi.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'permissions'
  ) then
    alter table public.profiles add column permissions text[] not null default '{}';
    alter table public.profiles add constraint profiles_permissions_valid
      check (permissions <@ array['users_view', 'users_add', 'users_block', 'users_reset', 'users_delete', 'ai_view', 'mail_view', 'stats_view']::text[]);
    update public.profiles
      set permissions = array['ai_view', 'mail_view', 'stats_view']
      where role = 'admin';
  end if;
end
$$;

-- Foydalanuvchi o'z ruxsatlarini o'zi o'zgartira olmaydi (jimgina eski qiymat qoladi).
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    if new.role is distinct from old.role then
      raise exception 'Ruxsat yo''q: o''z rolingizni o''zingiz o''zgartira olmaysiz';
    end if;
    if new.is_blocked is distinct from old.is_blocked then
      raise exception 'Ruxsat yo''q';
    end if;
    new.username := old.username;
    new.email := old.email;
    new.phone := old.phone;
    new.upload_kinds := old.upload_kinds;
    new.permissions := old.permissions;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_change on public.profiles;
create trigger trg_prevent_self_role_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ---------------------------------------------------------------------------
-- 2) Telegram bilan bog'langan raqamlar (faqat service-role)
-- ---------------------------------------------------------------------------
create table if not exists public.tg_contacts (
  phone text primary key,                    -- faqat raqamlar, masalan 998901234567
  tg_user_id bigint not null,
  chat_id bigint not null,
  lang text,                                 -- foydalanuvchining Telegram tili (bot xabarlari uchun)
  updated_at timestamptz not null default now()
);
create index if not exists tg_contacts_user_idx on public.tg_contacts (tg_user_id);
alter table public.tg_contacts enable row level security;
-- Policy ataylab yozilmagan — klientdan kirib bo'lmaydi.

-- ---------------------------------------------------------------------------
-- 3) tg_verifications: yangi maqsad va holatlar; raqam 'register-tg' da keyin aniqlanadi
-- ---------------------------------------------------------------------------
alter table public.tg_verifications alter column phone drop not null;

alter table public.tg_verifications drop constraint if exists tg_verifications_purpose_check;
alter table public.tg_verifications add constraint tg_verifications_purpose_check
  check (purpose in ('register', 'phone-change', 'register-tg', 'reset'));

alter table public.tg_verifications drop constraint if exists tg_verifications_status_check;
alter table public.tg_verifications add constraint tg_verifications_status_check
  check (status in ('pending', 'await_contact', 'code_sent', 'verified'));

-- ---------------------------------------------------------------------------
-- 4) Yangi usul: Telegram orqali ro'yxatdan o'tish (standart: o'chiq)
-- ---------------------------------------------------------------------------
insert into public.secure_settings (key, value) values ('reg_telegram', 'off')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 5) Super admin va adminlarning ma'lumotlari hech kimga ko'rinmasin:
--    materiallarda yuklovchining login'i (uploaded_by) endi saqlanmaydi; avval saqlanganlari tozalanadi.
-- ---------------------------------------------------------------------------
update public.media_items m
   set uploaded_by = null
  from public.profiles p
 where p.role in ('admin', 'superadmin')
   and m.uploaded_by is not null
   and lower(p.username) = lower(m.uploaded_by);
