UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE id = '3942d9f6-004d-4014-8f17-b25a8474d1f0';

INSERT INTO public.users (
  username,
  role,
  auth_id,
  employee_code,
  commission_rate
)
VALUES (
  'admin',
  'super_admin',
  '3942d9f6-004d-4014-8f17-b25a8474d1f0',
  NULL,
  0
)
ON CONFLICT (username) DO UPDATE
SET
  role = EXCLUDED.role,
  auth_id = EXCLUDED.auth_id,
  employee_code = EXCLUDED.employee_code,
  commission_rate = EXCLUDED.commission_rate;
