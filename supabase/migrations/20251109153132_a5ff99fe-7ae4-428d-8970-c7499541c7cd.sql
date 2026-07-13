-- Create categories table
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Anyone can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

-- Super admins can manage categories
CREATE POLICY "Super admins can manage categories" 
ON public.categories 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add some default categories
INSERT INTO public.categories (name, description) VALUES
  ('Tops', 'Shirts, blouses, t-shirts, and other tops'),
  ('Bottoms', 'Pants, shorts, skirts'),
  ('Dresses', 'All types of dresses'),
  ('Outerwear', 'Jackets, coats, sweaters'),
  ('Accessories', 'Bags, belts, jewelry, etc.'),
  ('Shoes', 'All types of footwear');

-- Create trigger for updating timestamp
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_product_timestamp();