-- Fix auth integration by mapping app users to backend auth users and secure RLS

-- 1) Add auth_id column to users to map to authenticated user id
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE;

-- 2) Ensure product timestamp trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_product_last_updated'
  ) THEN
    CREATE TRIGGER set_product_last_updated
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_product_timestamp();
  END IF;
END $$;

-- 3) Update helper function to read role using auth_id instead of id
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.users WHERE auth_id = user_id LIMIT 1;
$$;

-- 4) Tighten users SELECT policy and align with auth_id
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
CREATE POLICY "Users can view their own data" ON public.users
FOR SELECT
USING (auth.uid() = auth_id OR public.get_user_role(auth.uid()) = 'super_admin');

-- 5) Keep bootstrap/insert policies as-is, but ensure manage policy uses helper function
DROP POLICY IF EXISTS "Super admins can manage all users" ON public.users;
CREATE POLICY "Super admins can manage all users" ON public.users
FOR ALL
USING (public.get_user_role(auth.uid()) = 'super_admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'super_admin');

-- 6) Products: keep public read, ensure manage uses helper
DROP POLICY IF EXISTS "Supervisors and admins can manage products" ON public.products;
CREATE POLICY "Admins and supervisors can manage products" ON public.products
FOR ALL
USING (public.get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role,'supervisor'::user_role]))
WITH CHECK (public.get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role,'supervisor'::user_role]));

-- 7) Sales: allow staff (employee and above) to manage
DROP POLICY IF EXISTS "Supervisors and admins can manage sales" ON public.sales;
CREATE POLICY "Staff can manage sales" ON public.sales
FOR ALL
USING (public.get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role,'supervisor'::user_role,'employee'::user_role]))
WITH CHECK (public.get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role,'supervisor'::user_role,'employee'::user_role]));

-- 8) History: allow staff to insert
DROP POLICY IF EXISTS "Supervisors and admins can add history" ON public.history;
CREATE POLICY "Staff can add history" ON public.history
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::user_role,'supervisor'::user_role,'employee'::user_role]));

-- Note: existing SELECT policies remain open for read-only access as before.
