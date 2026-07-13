-- Make password_hash optional so we can manage auth via the backend auth system
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Allow the very first authenticated user to bootstrap an admin record in users
CREATE POLICY "Bootstrap first user as any role when table empty"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK ((SELECT COUNT(*) = 0 FROM public.users));

-- Allow any authenticated user to create their own user row as employee
CREATE POLICY "Authenticated users can create their own user row as employee"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK ((id = auth.uid() AND role = 'employee'::user_role));
