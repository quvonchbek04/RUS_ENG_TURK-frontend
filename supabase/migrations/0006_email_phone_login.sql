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
