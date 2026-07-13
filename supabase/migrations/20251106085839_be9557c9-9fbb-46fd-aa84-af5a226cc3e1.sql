-- Fix the get_user_role function to have proper search_path using CASCADE
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT role FROM public.users WHERE id = user_id LIMIT 1;
$$;

-- Recreate the policies that were dropped
CREATE POLICY "Super admins can manage all users"
  ON public.users FOR ALL
  USING (public.get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "Supervisors and admins can manage products"
  ON public.products FOR ALL
  USING (
    public.get_user_role(auth.uid()) IN ('super_admin', 'supervisor')
  );

CREATE POLICY "Supervisors and admins can add history"
  ON public.history FOR INSERT
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin', 'supervisor', 'employee')
  );

CREATE POLICY "Supervisors and admins can manage sales"
  ON public.sales FOR ALL
  USING (
    public.get_user_role(auth.uid()) IN ('super_admin', 'supervisor', 'employee')
  );