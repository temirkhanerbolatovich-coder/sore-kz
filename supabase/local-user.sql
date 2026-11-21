-- Local CLI only. Hosted deployments create this user through Auth Admin API/Studio.
-- Колонки *_token заполнены пустыми строками: GoTrue не умеет читать NULL в них,
-- и без этого вход по email и /admin/users для такого пользователя падают с unexpected_failure.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values ('d0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','demo@sore.kz',now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),
  '','','','','','','','')
on conflict (id) do update set
  confirmation_token = coalesce(auth.users.confirmation_token, ''),
  recovery_token = coalesce(auth.users.recovery_token, ''),
  email_change_token_new = coalesce(auth.users.email_change_token_new, ''),
  email_change = coalesce(auth.users.email_change, ''),
  email_change_token_current = coalesce(auth.users.email_change_token_current, ''),
  phone_change = coalesce(auth.users.phone_change, ''),
  phone_change_token = coalesce(auth.users.phone_change_token, ''),
  reauthentication_token = coalesce(auth.users.reauthentication_token, '');
