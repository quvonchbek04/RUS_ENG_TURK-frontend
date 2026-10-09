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
