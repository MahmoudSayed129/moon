-- Temporarily allow operations without auth check until users are synced
-- This is needed because existing users don't have auth_id yet

-- Products: allow insert/update/delete for now
DROP POLICY IF EXISTS "Admins and supervisors can manage products" ON public.products;
CREATE POLICY "Admins and supervisors can manage products" ON public.products
FOR ALL
USING (true)
WITH CHECK (true);

-- Sales: allow all operations
DROP POLICY IF EXISTS "Staff can manage sales" ON public.sales;
CREATE POLICY "Staff can manage sales" ON public.sales
FOR ALL
USING (true)
WITH CHECK (true);

-- History: allow insert
DROP POLICY IF EXISTS "Staff can add history" ON public.history;
CREATE POLICY "Staff can add history" ON public.history
FOR INSERT
WITH CHECK (true);

-- Users: keep current policies
-- (SELECT is already open, UPDATE allows sync, super_admin policy exists)