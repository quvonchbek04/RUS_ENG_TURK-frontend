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
