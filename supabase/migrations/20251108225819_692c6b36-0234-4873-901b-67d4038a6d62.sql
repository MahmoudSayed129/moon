-- Fix authentication by allowing bootstrap and sync operations

-- 1) Allow reading users without auth for login check (SELECT only)
DROP POLICY IF EXISTS "Anyone can view users for login" ON public.users;
CREATE POLICY "Anyone can view users for login" ON public.users
FOR SELECT
USING (true);

-- 2) Keep super admin management policy
-- (already exists from previous migration)

-- 3) Allow sync-user-auth function to update auth_id
DROP POLICY IF EXISTS "Allow auth sync updates" ON public.users;
CREATE POLICY "Allow auth sync updates" ON public.users
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 4) Keep bootstrap policy for first user
-- (already exists from previous migration)