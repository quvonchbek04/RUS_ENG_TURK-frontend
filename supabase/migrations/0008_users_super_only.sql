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
