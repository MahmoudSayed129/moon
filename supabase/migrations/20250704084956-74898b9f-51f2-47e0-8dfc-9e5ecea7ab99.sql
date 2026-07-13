
-- Remove user_id column from products table and update constraints
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE public.products DROP COLUMN IF EXISTS user_id;

-- Remove user_id column from history table and update constraints
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_user_id_fkey;
ALTER TABLE public.history DROP COLUMN IF EXISTS user_id;

-- Remove user_id column from sales table and update constraints
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.sales DROP COLUMN IF EXISTS user_id;

-- Update RLS policies to remove user_id checks
DROP POLICY IF EXISTS "Super admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Users can view all products" ON public.products;

CREATE POLICY "Authenticated users can manage products" 
  ON public.products 
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for history
DROP POLICY IF EXISTS "Super admins can manage history" ON public.history;
DROP POLICY IF EXISTS "Users can view all history" ON public.history;

CREATE POLICY "Authenticated users can manage history" 
  ON public.history 
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for sales
DROP POLICY IF EXISTS "Super admins can manage sales" ON public.sales;
DROP POLICY IF EXISTS "Users can view all sales" ON public.sales;

CREATE POLICY "Authenticated users can manage sales" 
  ON public.sales 
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);
