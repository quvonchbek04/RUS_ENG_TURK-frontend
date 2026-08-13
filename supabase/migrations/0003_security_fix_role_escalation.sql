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
