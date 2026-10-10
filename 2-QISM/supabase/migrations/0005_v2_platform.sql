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
