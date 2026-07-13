
-- Add user_id column back to products table
ALTER TABLE public.products ADD COLUMN user_id UUID NOT NULL DEFAULT '56170149-aea1-4a4c-9328-bcc6dd9435d7';

-- Add user_id column back to history table  
ALTER TABLE public.history ADD COLUMN user_id UUID NOT NULL DEFAULT '56170149-aea1-4a4c-9328-bcc6dd9435d7';

-- Add user_id column back to sales table
ALTER TABLE public.sales ADD COLUMN user_id UUID NOT NULL DEFAULT '56170149-aea1-4a4c-9328-bcc6dd9435d7';

-- Update RLS policies to use the fixed user ID for products
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
CREATE POLICY "Users can manage products with fixed user_id" 
  ON public.products 
  FOR ALL 
  TO authenticated
  USING (user_id = '56170149-aea1-4a4c-9328-bcc6dd9435d7'::uuid)
  WITH CHECK (user_id = '56170149-aea1-4a4c-9328-bcc6dd9435d7'::uuid);

-- Update RLS policies to use the fixed user ID for history
DROP POLICY IF EXISTS "Authenticated users can manage history" ON public.history;
CREATE POLICY "Users can manage history with fixed user_id" 
  ON public.history 
  FOR ALL 
  TO authenticated
  USING (user_id = '56170149-aea1-4a4c-9328-bcc6dd9435d7'::uuid)
  WITH CHECK (user_id = '56170149-aea1-4a4c-9328-bcc6dd9435d7'::uuid);

-- Update RLS policies to use the fixed user ID for sales
DROP POLICY IF EXISTS "Authenticated users can manage sales" ON public.sales;
CREATE POLICY "Users can manage sales with fixed user_id" 
  ON public.sales 
  FOR ALL 
  TO authenticated
  USING (user_id = '56170149-aea1-4a4c-9328-bcc6dd9435d7'::uuid)
  WITH CHECK (user_id = '56170149-aea1-4a4c-9328-bcc6dd9435d7'::uuid);
