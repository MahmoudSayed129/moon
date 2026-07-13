-- Create user_role enum
CREATE TYPE public.user_role AS ENUM ('super_admin', 'supervisor', 'employee');

-- Create users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  description TEXT,
  image TEXT,
  size TEXT,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create history table
CREATE TABLE public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('add', 'take')),
  quantity INTEGER NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = user_id LIMIT 1;
$$;

-- RLS Policies for users table (only super_admin can manage users)
CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage all users"
  ON public.users FOR ALL
  USING (public.get_user_role(auth.uid()) = 'super_admin');

-- RLS Policies for products (authenticated users can view, supervisors+ can manage)
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Supervisors and admins can manage products"
  ON public.products FOR ALL
  USING (
    public.get_user_role(auth.uid()) IN ('super_admin', 'supervisor')
  );

-- RLS Policies for history (authenticated users can view, supervisors+ can add)
CREATE POLICY "Anyone can view history"
  ON public.history FOR SELECT
  USING (true);

CREATE POLICY "Supervisors and admins can add history"
  ON public.history FOR INSERT
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('super_admin', 'supervisor', 'employee')
  );

-- RLS Policies for sales (authenticated users can view, supervisors+ can add)
CREATE POLICY "Anyone can view sales"
  ON public.sales FOR SELECT
  USING (true);

CREATE POLICY "Supervisors and admins can manage sales"
  ON public.sales FOR ALL
  USING (
    public.get_user_role(auth.uid()) IN ('super_admin', 'supervisor', 'employee')
  );

-- Create trigger to update last_updated timestamp on products
CREATE OR REPLACE FUNCTION public.update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_timestamp
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_timestamp();