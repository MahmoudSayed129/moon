
-- First, let's check what user_id references are being used and fix the foreign key constraint
-- We need to remove the foreign key constraint that references auth.users since we're using our own users table

-- Drop the existing foreign key constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;

-- Add a new foreign key constraint that references our public.users table
ALTER TABLE public.products ADD CONSTRAINT products_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Do the same for history table
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_user_id_fkey;
ALTER TABLE public.history ADD CONSTRAINT history_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Do the same for sales table  
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
