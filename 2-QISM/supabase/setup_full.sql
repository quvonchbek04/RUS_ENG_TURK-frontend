-- ============================================================================
-- "Til sayohati" — TO'LIQ O'RNATISH (bitta fayl)
-- Yangi Supabase loyihasida: SQL Editor → shu faylning butun matnini joylang → Run.
-- Ichida migrations/0001…0011 fayllar ketma-ket birlashtirilgan. Qayta ishga
-- tushirish xavfsiz (barcha buyruqlar "if not exists" / "on conflict").
-- Super admin yaratiladi: login = quvonchbek, parol = admin123
-- ============================================================================

-- >>>>>>>>>>>>>>>>>>>> 0001_init.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- "Til sayohati" — Supabase Postgres sxemasi
-- Bu faylni Supabase loyihangizda SQL Editor orqali (yoki `supabase db push`
-- bilan) bir marta ishga tushiring.
-- ============================================================================

-- ---------- 1) PROFILLAR (auth.users ga qo'shimcha ma'lumot) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin', 'superadmin')),
  created_at timestamptz not null default now()
);

-- ---------- 2) FOYDALANUVCHI PROGRESSI (har bir user uchun bitta qator) ----------
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- 3) KUTUBXONA (umumiy kitoblar/matnlar) ----------
create table if not exists public.books (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  lang text not null,
  ext text not null default 'txt',
  content_text text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

-- ---------- 4) LUG'AT TO'PLAMLARI (umumiy) ----------
create table if not exists public.vocab_sets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  lang text not null,
  ext text not null default 'txt',
  words jsonb not null default '[]'::jsonb,
  uploaded_by text,
  created_at timestamptz not null default now()
);

-- ---------- 5) OMMAVIY SOZLAMALAR (masalan ai_provider — sir emas) ----------
create table if not exists public.settings (
  key text primary key,
  value text not null default ''
);
insert into public.settings (key, value) values ('ai_provider', 'mock')
  on conflict (key) do nothing;

-- ---------- 6) MAXFIY SOZLAMALAR (masalan Gemini API kalit — hech qachon
--              klient tomonidan to'g'ridan-to'g'ri o'qilmaydi/yozilmaydi,
--              faqat Edge Function ichida service-role orqali) ----------
create table if not exists public.secure_settings (
  key text primary key,
  value text not null default ''
);
insert into public.secure_settings (key, value) values ('gemini_api_key', '')
  on conflict (key) do nothing;


-- ============================================================================
-- YORDAMCHI FUNKSIYA: joriy foydalanuvchining rolini qaytaradi
-- ============================================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;


-- ============================================================================
-- YANGI FOYDALANUVCHI RO'YXATDAN O'TGANDA: profiles + progress qatorlarini
-- avtomatik yaratuvchi trigger (auth.users ga yozilganda ishga tushadi)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;

  insert into public.progress (user_id, state) values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.books enable row level security;
alter table public.vocab_sets enable row level security;
alter table public.settings enable row level security;
alter table public.secure_settings enable row level security;
-- Eslatma: secure_settings uchun QASDDAN hech qanday policy yozilmaydi —
-- shu sababli RLS uni klientdan (anon/authenticated) BUTUNLAY yopib qo'yadi.
-- Faqat Edge Function ichidagi service-role kalit RLS'ni chetlab o'tib o'qiy/yoza oladi.

-- ---------- profiles ----------
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.current_role() in ('admin', 'superadmin'));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- progress: faqat o'z qatoriga ruxsat ----------
drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- books: hammaga ko'rinadi, faqat admin/superadmin yoza oladi ----------
drop policy if exists "books_select_all" on public.books;
create policy "books_select_all" on public.books
  for select using (true);

drop policy if exists "books_write_admin" on public.books;
create policy "books_write_admin" on public.books
  for all using (public.current_role() in ('admin', 'superadmin'))
  with check (public.current_role() in ('admin', 'superadmin'));

-- ---------- vocab_sets: hammaga ko'rinadi, faqat admin/superadmin yoza oladi ----------
drop policy if exists "vocab_sets_select_all" on public.vocab_sets;
create policy "vocab_sets_select_all" on public.vocab_sets
  for select using (true);

drop policy if exists "vocab_sets_write_admin" on public.vocab_sets;
create policy "vocab_sets_write_admin" on public.vocab_sets
  for all using (public.current_role() in ('admin', 'superadmin'))
  with check (public.current_role() in ('admin', 'superadmin'));

-- ---------- settings: kirgan foydalanuvchilar o'qiy oladi, faqat superadmin yoza oladi ----------
drop policy if exists "settings_select_authenticated" on public.settings;
create policy "settings_select_authenticated" on public.settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "settings_update_superadmin" on public.settings;
create policy "settings_update_superadmin" on public.settings
  for update using (public.current_role() = 'superadmin')
  with check (public.current_role() = 'superadmin');


-- ============================================================================
-- BIRINCHI SUPERADMIN'NI YARATISH (qo'lda, bir martalik)
-- ============================================================================
-- 1) Avval saytda oddiy "Ro'yxatdan o'tish" orqali login="Quvonchbek",
--    parol="admin123" bilan ro'yxatdan o'ting (u avtomatik 'user' bo'lib yaraladi).
-- 2) Shundan so'ng shu SQL buyrug'ini SQL Editor'da ishga tushiring:
--
--    update public.profiles set role = 'superadmin' where username = 'Quvonchbek';
--
-- Shu qadamdan keyin u super admin bo'ladi va admin panelga kira oladi.

-- >>>>>>>>>>>>>>>>>>>> 0002_multi_api_keys.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 0003_security_fix_role_escalation.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- "Til sayohati" — XAVFSIZLIK TUZATISHI (0001 dan keyin, SHART ishga tushiring)
-- Loyihani tekshirganda ikkita jiddiy "imtiyozni oshirish" (privilege escalation)
-- teshigi topildi. Bu fayl ularni yopadi. Supabase SQL Editor'da ishga tushiring.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- MUAMMO 1 (ENG JIDDIY): handle_new_user() trigger'i yangi ro'yxatdan
-- o'tayotgan foydalanuvchining rolini uning O'ZI yuborgan
-- raw_user_meta_data->>'role' qiymatidan olar edi. Supabase Auth'da
-- signUp() chaqirilganda "options.data" ichiga NIMA XOHLASA O'SHANI
-- yozish mumkin — ya'ni har qanday kishi brauzer konsolidan:
--
--   supabase.auth.signUp({
--     email: "hack@til-sayohati.local", password: "12345678",
--     options: { data: { role: "superadmin", username: "hack" } }
--   })
--
-- deb yozib, TO'G'RIDAN-TO'G'RI superadmin bo'lib ro'yxatdan o'tishi mumkin
-- edi. Tuzatish: trigger endi rolni HECH QACHON metadata'dan olmaydi —
-- yangi hisob doim 'user' bo'lib yaratiladi. Kimnidir admin qilish FAQAT
-- Edge Function (/functions/v1/admin, action "create-admin") orqali,
-- service-role kalit bilan, superadmin tasdig'idan keyin bajariladi.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'),
    'user'  -- <-- endi doim 'user'; metadata'dagi 'role' MUTLAQO e'tiborga olinmaydi
  )
  on conflict (id) do nothing;

  insert into public.progress (user_id, state) values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- MUAMMO 2 (QO'SHIMCHA HIMOYA QATLAMI): "profiles_update_own" policy'si
-- foydalanuvchiga o'z qatorining ISTALGAN ustunini (jumladan `role`ni ham)
-- o'zgartirishga ruxsat berardi:
--
--   supabase.from('profiles').update({ role: 'superadmin' }).eq('id', user.id)
--
-- — bu ham RLS darajasida ishlab, foydalanuvchini o'zini-o'zi admin qilib
-- qo'yishi mumkin edi. Tuzatish: har bir UPDATE'dan oldin trigger orqali
-- tekshiramiz — agar so'rovni yuborayotgan HUZURDAGI foydalanuvchi (auth.uid())
-- aynan shu qatorning egasi bo'lsa (ya'ni bu o'z-o'ziga so'rov, admin panel
-- orqali emas) va u `role`ni o'zgartirishga urinsa — bloklaymiz. Edge Function
-- (service-role) orqali kelgan so'rovlarda auth.uid() bo'sh bo'lgani uchun bu
-- tekshiruv ularga taalluqli emas — admin/superadmin funksiyalari bemalol
-- ishlayveradi.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and new.role is distinct from old.role then
    raise exception 'Ruxsat yo''q: o''z rolingizni o''zingiz o''zgartira olmaysiz';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_change on public.profiles;
create trigger trg_prevent_self_role_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ----------------------------------------------------------------------------
-- Tekshiruv uchun: agar avval kimdir shu teshiklardan foydalanib o'zini
-- noto'g'ri ravishda admin/superadmin qilib qo'ygan bo'lsa, quyidagi so'rov
-- bilan barcha adminlar ro'yxatini ko'rib chiqing va kerak bo'lsa qo'lda
-- tuzating:
--
--   select id, username, role, created_at from public.profiles
--   where role in ('admin', 'superadmin') order by created_at;
--
--   -- shubhali qatorni oddiy foydalanuvchiga qaytarish uchun:
--   update public.profiles set role = 'user' where username = 'SHUBHALI_LOGIN';
-- ----------------------------------------------------------------------------

-- >>>>>>>>>>>>>>>>>>>> 0004_seed_superadmin.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- Super admin: login = quvonchbek, parol = admin123
-- SQL Editor'da 0001–0003 dan KEYIN ishga tushiring.
--
-- XAVFSIZ QAYTA ISHGA TUSHIRISH: foydalanuvchi allaqachon bo'lsa, u O'CHIRILMAYDI
-- va paroli ham o'zgartirilmaydi — faqat roli 'superadmin' qilib qo'yiladi.
-- (Avvalgi versiya har safar o'chirib qayta yaratardi va progressni yo'qotardi.)
-- ============================================================================
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  uid uuid;
  mail text := 'quvonchbek@til-sayohati.app';
begin
  select id into uid from auth.users where lower(email) = mail;

  if uid is null then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
      extensions.crypt('admin123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"quvonchbek","display_name":"Quvonchbek"}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  -- handle_new_user triggeri profilni 'user' roli bilan yaratadi; shuni ko'taramiz
  insert into public.profiles (id, username, display_name, role)
  values (uid, 'quvonchbek', 'Quvonchbek', 'superadmin')
  on conflict (id) do update set role = 'superadmin';

  insert into public.progress (user_id, state) values (uid, '{}'::jsonb)
  on conflict (user_id) do nothing;
end $$;

-- Tekshirish:
-- select username, role from public.profiles where role = 'superadmin';

-- >>>>>>>>>>>>>>>>>>>> 0005_v2_platform.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- "Til sayohati" v2 — 0001…0004 dan KEYIN ishga tushiring (qayta ishga
-- tushirish xavfsiz: hamma buyruqlar "if not exists" / "on conflict" bilan).
--
-- Nimalar qo'shiladi:
--   1) profiles: email, telefon, bloklash, oxirgi faollik ustunlari
--   2) Ro'yxatdan o'tish (email YOKI telefon) uchun yangilangan trigger
--   3) Yagona media jadvali (musiqa/audio, video, rasm, matn, dialog, lug'at,
--      yangiliklar) + Supabase Storage "media" bucket va uning siyosatlari
--   4) Eski kutubxona (books) va lug'at to'plamlari (vocab_sets) media'ga ko'chiriladi
--   5) AI: bir nechta provayder (Gemini, OpenAI, Groq, OpenRouter, DeepSeek,
--      boshqa OpenAI-mos), model sozlamalari, kunlik limit va foydalanish hisobi
--   6) Adminlar foydalanuvchilar progressini (faqat o'qish) ko'ra oladi
--   7) Super admin (quvonchbek / admin123) borligi kafolatlanadi
-- ============================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) PROFILES — yangi ustunlar
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Joriy foydalanuvchi admin yoki super adminmi (RLS siyosatlarida ishlatiladi)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('admin', 'superadmin') from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- 2) YANGI FOYDALANUVCHI TRIGGERI
--    • rol HECH QACHON metadata'dan olinmaydi (doim 'user')
--    • login (username) band bo'lsa, oxiriga raqam qo'shib noyob qilinadi
--    • haqiqiy email va telefon profilga yoziladi (sun'iy @til-sayohati.app emas)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
  v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
  v_email text;
begin
  base := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1), 'user');
  base := left(regexp_replace(base, '\s+', '', 'g'), 40);
  if base is null or base = '' then base := 'user'; end if;

  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  v_email := case when new.email like '%@til-sayohati.app' then null else new.email end;

  insert into public.profiles (id, username, display_name, role, email, phone)
  values (
    new.id,
    candidate,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), candidate),
    'user',
    v_email,
    v_phone
  )
  on conflict (id) do nothing;

  insert into public.progress (user_id, state) values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Foydalanuvchi o'z profilida faqat ismini (display_name) va last_seen_at ni
-- o'zgartira oladi. Rol va bloklash — taqiqlanadi (xato), login/email/telefon —
-- jimgina eski qiymatda qoldiriladi. Edge Function (service-role) uchun
-- auth.uid() bo'sh bo'ladi — shuning uchun admin amallari bemalol ishlaydi.
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_change on public.profiles;
create trigger trg_prevent_self_role_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ---------------------------------------------------------------------------
-- 3) MEDIA — barcha yuklanadigan materiallar uchun yagona jadval
--    kind: audio (musiqa), video, image (rasm), text (matn), dialog, vocab
--          (lug'at), news (yangilik/e'lon)
--    content (jsonb):
--      text   → {"text": "..."}
--      dialog → {"lines": [["A","Hello","Salom"], ...]}
--      vocab  → {"words": [["word","talaffuz","tarjima"], ...]}
--      news   → {"text": "..."}
--      audio/video/image → {"text": "qo'shiq matni / izoh (ixtiyoriy)"}
-- ---------------------------------------------------------------------------
create table if not exists public.media_items (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('audio', 'video', 'image', 'text', 'dialog', 'vocab', 'news')),
  lang text not null default 'all' check (lang in ('all', 'en', 'ru', 'tr')),
  title text not null,
  description text,
  storage_path text,
  file_url text,
  mime text,
  size_bytes bigint,
  content jsonb not null default '{}'::jsonb,
  lesson_ref text,
  position integer not null default 0,
  is_published boolean not null default true,
  legacy_ref text unique,
  created_by uuid references auth.users(id) on delete set null,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_items_kind_idx on public.media_items (kind, lang, position, created_at);
create index if not exists media_items_lesson_idx on public.media_items (lang, lesson_ref);

alter table public.media_items enable row level security;

drop policy if exists "media_select" on public.media_items;
create policy "media_select" on public.media_items
  for select using (auth.role() = 'authenticated' and (is_published or public.is_staff()));

drop policy if exists "media_write_staff" on public.media_items;
create policy "media_write_staff" on public.media_items
  for all using (public.is_staff()) with check (public.is_staff());

-- Storage bucket (ommaviy o'qish — fayl URL'i orqali; yozish faqat adminlarga)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true;

drop policy if exists "media_files_read" on storage.objects;
create policy "media_files_read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media_files_insert" on storage.objects;
create policy "media_files_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_staff());

drop policy if exists "media_files_update" on storage.objects;
create policy "media_files_update" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_staff());

drop policy if exists "media_files_delete" on storage.objects;
create policy "media_files_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_staff());

-- ---------------------------------------------------------------------------
-- 4) ESKI MA'LUMOTLARNI KO'CHIRISH (bir marta; legacy_ref takrorlanishni oldini oladi)
-- ---------------------------------------------------------------------------
insert into public.media_items (kind, lang, title, content, mime, uploaded_by, created_by, created_at, legacy_ref)
select 'text', b.lang, b.title, jsonb_build_object('text', b.content_text, 'ext', b.ext), b.ext,
       b.uploaded_by, b.user_id, b.created_at, 'book:' || b.id
from public.books b
where b.lang in ('en', 'ru', 'tr')
on conflict (legacy_ref) do nothing;

insert into public.media_items (kind, lang, title, content, mime, uploaded_by, created_by, created_at, legacy_ref)
select 'vocab', v.lang, v.title, jsonb_build_object('words', v.words), v.ext,
       v.uploaded_by, v.user_id, v.created_at, 'vocab:' || v.id
from public.vocab_sets v
where v.lang in ('en', 'ru', 'tr')
on conflict (legacy_ref) do nothing;

-- ---------------------------------------------------------------------------
-- 5) AI — bir nechta provayder, model sozlamalari, kunlik limit
-- ---------------------------------------------------------------------------
alter table public.api_keys add column if not exists base_url text;
alter table public.api_keys add column if not exists model text;
alter table public.api_keys add column if not exists priority integer not null default 100;
alter table public.api_keys add column if not exists success_count integer not null default 0;

insert into public.settings (key, value) values
  ('ai_model_gemini', 'gemini-flash-latest'),
  ('ai_daily_limit', '150')
on conflict (key) do nothing;

-- 'auto' — qaysi provayderning faol kaliti bo'lsa, o'shani ishlatadi (kalit
-- bo'lmasa avtomatik oddiy rejim). Eski standart 'mock' qiymati 'auto'ga o'tkaziladi.
update public.settings set value = 'auto' where key = 'ai_provider' and value = 'mock';

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select" on public.ai_usage;
create policy "ai_usage_select" on public.ai_usage
  for select using (auth.uid() = user_id or public.is_staff());

-- Atomar hisoblagich — faqat Edge Function (service-role) chaqira oladi
create or replace function public.bump_ai_usage(p_user uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count;
$$;
revoke all on function public.bump_ai_usage(uuid) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6) Adminlar o'quvchilar progressini ko'ra oladi (faqat o'qish)
-- ---------------------------------------------------------------------------
drop policy if exists "progress_select_staff" on public.progress;
create policy "progress_select_staff" on public.progress
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- 7) Super admin kafolati (quvonchbek / admin123). Mavjud bo'lsa paroli
--    o'zgartirilmaydi, faqat roli 'superadmin' va bloklanmagan holatga keltiriladi.
-- ---------------------------------------------------------------------------
do $$
declare
  uid uuid;
  mail text := 'quvonchbek@til-sayohati.app';
begin
  select id into uid from auth.users where lower(email) = mail;

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
      extensions.crypt('admin123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"quvonchbek","display_name":"Quvonchbek"}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.profiles (id, username, display_name, role)
  values (uid, 'quvonchbek', 'Quvonchbek', 'superadmin')
  on conflict (id) do update set role = 'superadmin', is_blocked = false;

  insert into public.progress (user_id, state) values (uid, '{}'::jsonb)
  on conflict (user_id) do nothing;
end $$;

-- >>>>>>>>>>>>>>>>>>>> 0006_email_phone_login.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- "Til sayohati" — Email VA telefon bilan bir vaqtda ro'yxatdan o'tish
-- 0005 dan KEYIN ishga tushiring (qayta ishga tushirish xavfsiz).
--
-- • Foydalanuvchi ro'yxatdan o'tishda email ham, telefon ham kiritishi mumkin;
--   keyin email, telefon yoki login — qaysi biri qulay bo'lsa, shu bilan kiradi.
-- • Bitta telefon raqami faqat bitta hisobga biriktiriladi.
-- • Kirishda telefon/login → email'ga aylantirish "admin" Edge Function'ida
--   (action "login") server tomonda bajariladi — emaillar hech kimga ko'rinmaydi.
-- • Noto'g'ri parol bilan ko'p urinishdan himoya (login_attempts).
-- ============================================================================

-- Telefon raqami noyob bo'lsin (bir xil raqam bir nechta hisobda bo'lsa — eskisidan boshqalari tozalanadi)
update public.profiles p set phone = null
where phone is not null
  and exists (
    select 1 from public.profiles q
    where q.phone = p.phone and q.created_at < p.created_at
  );
create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;

-- Yangi foydalanuvchi triggeri: telefon band bo'lsa ro'yxatdan o'tish buzilmasin (telefon saqlanmaydi)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
  v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
  v_email text;
begin
  base := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1), 'user');
  base := left(regexp_replace(base, '\s+', '', 'g'), 40);
  if base is null or base = '' then base := 'user'; end if;

  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  if v_phone is not null and exists (select 1 from public.profiles where phone = v_phone) then
    v_phone := null;
  end if;

  v_email := case when new.email like '%@til-sayohati.app' then null else new.email end;

  insert into public.profiles (id, username, display_name, role, email, phone)
  values (
    new.id,
    candidate,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), candidate),
    'user',
    v_email,
    v_phone
  )
  on conflict (id) do nothing;

  insert into public.progress (user_id, state) values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Ro'yxatdan o'tish formasida "bu raqam band" deb oldindan aytish uchun
create or replace function public.phone_available(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where phone = p_phone);
$$;
revoke all on function public.phone_available(text) from public;
grant execute on function public.phone_available(text) to anon, authenticated;

-- Noto'g'ri parol bilan urinishlar hisobi (faqat Edge Function / service-role ishlatadi)
create table if not exists public.login_attempts (
  key text primary key,
  fails integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.login_attempts enable row level security;
-- Policy ataylab yozilmagan — klientdan butunlay yopiq.

-- >>>>>>>>>>>>>>>>>>>> 0007_email_codes.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 0008_users_super_only.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- "Til sayohati" — Foydalanuvchilar ma'lumoti FAQAT super adminga ko'rinadi
-- 0007 dan KEYIN ishga tushiring (qayta ishga tushirish xavfsiz).
--
-- Oldin adminlar ham barcha profillar va o'quvchilar progressini o'qiy olardi.
-- Endi: o'quvchi — faqat o'zinikini, super admin — hammasini ko'radi.
-- Oddiy admin (o'qituvchi) materiallar va AI bilan ishlaydi, lekin boshqa
-- foydalanuvchilar ma'lumotiga (hatto to'g'ridan-to'g'ri API so'rovi bilan ham) kira olmaydi.
-- ============================================================================

create or replace function public.is_super()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false);
$$;

-- profiles: o'zi yoki super admin
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_select_self_or_super" on public.profiles;
create policy "profiles_select_self_or_super" on public.profiles
  for select using ((select auth.uid()) = id or (select public.is_super()));

-- progress: o'zi (progress_select_own saqlanadi) yoki super admin
drop policy if exists "progress_select_staff" on public.progress;
drop policy if exists "progress_select_super" on public.progress;
create policy "progress_select_super" on public.progress
  for select using ((select public.is_super()));

-- AI foydalanish hisobi: o'zi yoki super admin
drop policy if exists "ai_usage_select" on public.ai_usage;
create policy "ai_usage_select" on public.ai_usage
  for select using ((select auth.uid()) = user_id or (select public.is_super()));

-- >>>>>>>>>>>>>>>>>>>> 0009_admin_permissions.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================================
-- "Til sayohati" — Adminlarning yuklash ruxsatlari va ro'yxatdan o'tish rejimi
-- 0008 dan KEYIN ishga tushiring (qayta ishga tushirish xavfsiz).
--
-- 1) Super admin har bir adminga QAYSI turdagi materialni yuklash/tahrirlash/
--    o'chirish mumkinligini belgilaydi: audio (musiqa), video, image (rasm),
--    text (matn), dialog, vocab (lug'at), news (yangilik).
--    • Ruxsatlar profiles.upload_kinds (text[]) ustunida saqlanadi.
--    • Super admin hamma turga ega (ro'yxat kerak emas).
--    • Cheklov faqat ekranda emas — media_items va Storage "media" bucket
--      siyosatlarida ham majburlanadi (to'g'ridan-to'g'ri API so'rovi ham o'tmaydi).
-- 2) Ro'yxatdan o'tishda email tasdiqlash kodi yoqilgan/o'chirilganligi
--    (secure_settings.signup_email_code = 'on' | 'off') — super admin panelidan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Ustun. Faqat BIRINCHI marta qo'shilganda mavjud adminlarga hamma tur
--    beriladi (avvalgi xatti-harakat saqlanadi). Qayta ishga tushirilsa,
--    super admin belgilagan ruxsatlar o'zgarmaydi.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'upload_kinds'
  ) then
    alter table public.profiles add column upload_kinds text[] not null default '{}';
    alter table public.profiles add constraint profiles_upload_kinds_valid
      check (upload_kinds <@ array['audio', 'video', 'image', 'text', 'dialog', 'vocab', 'news']::text[]);
    update public.profiles
      set upload_kinds = array['audio', 'video', 'image', 'text', 'dialog', 'vocab', 'news']
      where role in ('admin', 'superadmin');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2) Joriy foydalanuvchi shu turdagi materialni boshqara oladimi?
-- ---------------------------------------------------------------------------
create or replace function public.can_upload(p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (p.role = 'superadmin' or (p.role = 'admin' and p_kind = any(p.upload_kinds))) and not p.is_blocked
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- 3) media_items: yozish faqat ruxsat berilgan turlar uchun (o'qish — o'zgarmagan)
-- ---------------------------------------------------------------------------
drop policy if exists "media_write_staff" on public.media_items;
drop policy if exists "media_insert_permitted" on public.media_items;
drop policy if exists "media_update_permitted" on public.media_items;
drop policy if exists "media_delete_permitted" on public.media_items;

create policy "media_insert_permitted" on public.media_items
  for insert to authenticated
  with check (public.can_upload(kind));

create policy "media_update_permitted" on public.media_items
  for update to authenticated
  using (public.can_upload(kind))
  with check (public.can_upload(kind));

create policy "media_delete_permitted" on public.media_items
  for delete to authenticated
  using (public.can_upload(kind));

-- ---------------------------------------------------------------------------
-- 4) Storage "media" bucket: fayl yo'li "<tur>/<YYYY-MM>/<uuid>.<kengaytma>",
--    shuning uchun birinchi papka nomi — material turi.
-- ---------------------------------------------------------------------------
drop policy if exists "media_files_insert" on storage.objects;
create policy "media_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.can_upload((storage.foldername(name))[1]));

drop policy if exists "media_files_update" on storage.objects;
create policy "media_files_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.can_upload((storage.foldername(name))[1]))
  with check (bucket_id = 'media' and public.can_upload((storage.foldername(name))[1]));

drop policy if exists "media_files_delete" on storage.objects;
create policy "media_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.can_upload((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- 5) Foydalanuvchi o'z ruxsatlarini o'zi o'zgartira olmaydi (jimgina eski qiymat
--    qoladi). Super admin ularni Edge Function (service-role) orqali o'zgartiradi.
-- ---------------------------------------------------------------------------
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_change on public.profiles;
create trigger trg_prevent_self_role_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ---------------------------------------------------------------------------
-- 6) Ro'yxatdan o'tish rejimi: emailni tasdiqlash kodi bilan ('on', standart) yoki kodsiz ('off').
--    secure_settings klientdan yopiq; qiymatni faqat super admin Edge Function orqali o'zgartiradi.
-- ---------------------------------------------------------------------------
insert into public.secure_settings (key, value) values ('signup_email_code', 'on')
on conflict (key) do nothing;

-- >>>>>>>>>>>>>>>>>>>> 0010_signup_methods_telegram.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 0011_admin_function_permissions.sql <<<<<<<<<<<<<<<<<<<<
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
