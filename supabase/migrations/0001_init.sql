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
