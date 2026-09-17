-- ============================================================================
-- "Til sayohati" — TUZATISHLAR MIGRATSIYASI
-- 0001 → 0002 → 0003 dan KEYIN ishga tushiring (Supabase SQL Editor'da).
-- Bir necha marta ishga tushirsangiz ham zarar qilmaydi (idempotent).
--
-- Bu fayl quyidagilarni tuzatadi:
--   1. `public.current_role()` nomi Postgres'ning o'z `current_role` kalit
--      so'zini soyalab qo'yadi — chalkash va ba'zi kontekstlarda xatoga olib
--      keladi. Nomi `public.app_role()` ga o'zgartiriladi.
--   2. RLS siyosatlarida funksiya HAR BIR QATOR uchun qayta chaqirilardi —
--      katta jadvallarda sekinlik. Endi `(select ...)` ichida — bir marta.
--   3. `handle_new_user` trigger'i username to'qnashuvida butun ro'yxatdan
--      o'tishni "Database error saving new user" bilan buzardi.
--   4. `settings` jadvalida INSERT siyosati yo'q edi va `ai_provider` qatori
--      o'chib ketsa, AI sozlamalarini saqlash jimgina ishlamay qo'yardi.
--   5. Kerakli indekslar yo'q edi (lang bo'yicha filtr har safar to'liq skan).
--   6. `secure_settings` / `api_keys` ga klient uchun beriladigan ortiqcha
--      GRANT'lar olib tashlanadi (RLS ustiga qo'shimcha himoya qatlami).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Rolni qaytaruvchi funksiya — yangi, chalkashmaydigan nom bilan
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

revoke all on function public.app_role() from public;
grant execute on function public.app_role() to anon, authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon') in ('admin', 'superadmin');
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Siyosatlarni yangi funksiya bilan qayta yozamiz.
--    `(select public.app_role())` shakli — Postgres uni qator-qator emas,
--    bir marta hisoblaydi (Supabase'ning rasmiy tavsiyasi).
-- ---------------------------------------------------------------------------

-- ---------- profiles ----------
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (
    (select auth.uid()) = id or (select public.is_admin())
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------- books ----------
drop policy if exists "books_select_all" on public.books;
create policy "books_select_all" on public.books
  for select using (true);

-- MUHIM: avval bitta `for all` siyosati ishlatilgan edi. Uni alohida
-- insert/update/delete siyosatlariga bo'lamiz — shunda `with check` har bir
-- amal uchun aniq ishlaydi va nosozlikni topish osonlashadi.
drop policy if exists "books_write_admin" on public.books;
drop policy if exists "books_insert_admin" on public.books;
create policy "books_insert_admin" on public.books
  for insert with check ((select public.is_admin()) and (select auth.uid()) = user_id);

drop policy if exists "books_update_admin" on public.books;
create policy "books_update_admin" on public.books
  for update using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "books_delete_admin" on public.books;
create policy "books_delete_admin" on public.books
  for delete using ((select public.is_admin()));

-- ---------- vocab_sets ----------
drop policy if exists "vocab_sets_select_all" on public.vocab_sets;
create policy "vocab_sets_select_all" on public.vocab_sets
  for select using (true);

drop policy if exists "vocab_sets_write_admin" on public.vocab_sets;
drop policy if exists "vocab_sets_insert_admin" on public.vocab_sets;
create policy "vocab_sets_insert_admin" on public.vocab_sets
  for insert with check ((select public.is_admin()) and (select auth.uid()) = user_id);

drop policy if exists "vocab_sets_update_admin" on public.vocab_sets;
create policy "vocab_sets_update_admin" on public.vocab_sets
  for update using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "vocab_sets_delete_admin" on public.vocab_sets;
create policy "vocab_sets_delete_admin" on public.vocab_sets
  for delete using ((select public.is_admin()));

-- ---------- progress ----------
drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own" on public.progress
  for select using ((select auth.uid()) = user_id);

drop policy if exists "progress_insert_own" on public.progress;
create policy "progress_insert_own" on public.progress
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own" on public.progress
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------- settings ----------
drop policy if exists "settings_select_authenticated" on public.settings;
create policy "settings_select_authenticated" on public.settings
  for select using ((select auth.role()) = 'authenticated');

drop policy if exists "settings_update_superadmin" on public.settings;
create policy "settings_update_superadmin" on public.settings
  for update using ((select public.app_role()) = 'superadmin')
  with check ((select public.app_role()) = 'superadmin');

-- Avval INSERT siyosati umuman yo'q edi: agar `ai_provider` qatori bo'lmasa,
-- superadmin uni hech qachon yarata olmasdi.
drop policy if exists "settings_insert_superadmin" on public.settings;
create policy "settings_insert_superadmin" on public.settings
  for insert with check ((select public.app_role()) = 'superadmin');

-- Kerakli qator har doim mavjud bo'lsin.
insert into public.settings (key, value) values ('ai_provider', 'mock')
  on conflict (key) do nothing;

-- Eski funksiyani endi hech qaysi siyosat ishlatmaydi — olib tashlaymiz.
drop function if exists public.current_role();

-- ---------------------------------------------------------------------------
-- 3) Ro'yxatdan o'tish trigger'ini mustahkamlash
--    - `role` HECH QACHON metadata'dan olinmaydi (0003 dagi tuzatish saqlanadi)
--    - username band bo'lsa, butun ro'yxatdan o'tishni buzish o'rniga unikal
--      qilib qo'shimcha raqam qo'shiladi
--    - kutilmagan xato butun `auth.users` insert'ini bekor qilmasin
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := nullif(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))), '');
  if base_username is null then
    base_username := 'user';
  end if;

  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
    exit when suffix > 100;
  end loop;

  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    final_username,
    coalesce(nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''), final_username),
    'user'  -- metadata'dagi 'role' MUTLAQO e'tiborga olinmaydi (privilege escalation himoyasi)
  )
  on conflict (id) do nothing;

  insert into public.progress (user_id, state) values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    -- Profil yaratilmasa ham hisobning o'zi yaratilsin; api.me() bunday holatni
    -- aniqlab, foydalanuvchiga tushunarli xabar beradi.
    raise warning 'handle_new_user xatosi: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4) Mavjud, lekin profili yo'q foydalanuvchilarni tuzatish (bir martalik)
-- ---------------------------------------------------------------------------
insert into public.profiles (id, username, display_name, role)
select u.id,
       coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) || '_' || left(u.id::text, 4),
       coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
       'user'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

insert into public.progress (user_id, state)
select p.id, '{}'::jsonb from public.profiles p
where not exists (select 1 from public.progress g where g.user_id = p.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5) Indekslar — `lang` bo'yicha filtr va sanaga ko'ra tartiblash tez ishlashi uchun
-- ---------------------------------------------------------------------------
create index if not exists books_lang_idx on public.books (lang);
create index if not exists books_created_at_idx on public.books (created_at desc);
create index if not exists vocab_sets_lang_idx on public.vocab_sets (lang);
create index if not exists vocab_sets_created_at_idx on public.vocab_sets (created_at desc);
create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists api_keys_active_idx on public.api_keys (provider, is_active);

-- ---------------------------------------------------------------------------
-- 6) Maxfiy jadvallardan klient huquqlarini butunlay olib tashlash.
--    RLS siyosatsiz allaqachon yopiq, lekin bu qo'shimcha himoya qatlami:
--    kelajakda kimdir xato bilan siyosat qo'shib yuborsa ham kirish yopiq qoladi.
-- ---------------------------------------------------------------------------
revoke all on public.secure_settings from anon, authenticated;
revoke all on public.api_keys from anon, authenticated;
grant all on public.secure_settings to service_role;
grant all on public.api_keys to service_role;

-- ---------------------------------------------------------------------------
-- 7) Ma'lumotlar yaxlitligi tekshiruvlari
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_lang_check'
  ) then
    -- `not valid`: mavjud (ehtimol eski) qatorlar tekshirilmaydi, shuning uchun
    -- migratsiya hech qachon mavjud ma'lumot sababli yiqilmaydi.
    alter table public.books add constraint books_lang_check check (lang in ('ru', 'en', 'tr')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'vocab_sets_lang_check'
  ) then
    alter table public.vocab_sets add constraint vocab_sets_lang_check check (lang in ('ru', 'en', 'tr')) not valid;
  end if;
end $$;
