-- Fix the update_product_timestamp function to have proper search_path
DROP FUNCTION IF EXISTS public.update_product_timestamp() CASCADE;

CREATE OR REPLACE FUNCTION public.update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path TO public;

-- Recreate the trigger
CREATE TRIGGER update_products_timestamp
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_timestamp();