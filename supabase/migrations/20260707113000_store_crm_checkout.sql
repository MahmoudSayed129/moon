ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS employee_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Admins and supervisors can manage products" ON public.products;
DROP POLICY IF EXISTS "Supervisors and admins can manage products" ON public.products;
CREATE POLICY "Staff can manage products" ON public.products
FOR ALL
USING (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['super_admin'::user_role, 'supervisor'::user_role, 'employee'::user_role]
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['super_admin'::user_role, 'supervisor'::user_role, 'employee'::user_role]
  )
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  employee_code TEXT,
  sold_by_auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_barcode TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_timestamp_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp_column();

DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "Authenticated users can view clients" ON public.clients
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
CREATE POLICY "Authenticated users can create clients" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
CREATE POLICY "Authenticated users can update clients" ON public.clients
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Managers can delete clients" ON public.clients;
CREATE POLICY "Managers can delete clients" ON public.clients
FOR DELETE TO authenticated
USING (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['super_admin'::user_role, 'supervisor'::user_role]
  )
);

DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
CREATE POLICY "Authenticated users can view orders" ON public.orders
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
CREATE POLICY "Authenticated users can create orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Managers can update orders" ON public.orders;
CREATE POLICY "Managers can update orders" ON public.orders
FOR UPDATE TO authenticated
USING (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['super_admin'::user_role, 'supervisor'::user_role]
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['super_admin'::user_role, 'supervisor'::user_role]
  )
);

DROP POLICY IF EXISTS "Authenticated users can view order items" ON public.order_items;
CREATE POLICY "Authenticated users can view order items" ON public.order_items
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create order items" ON public.order_items;
CREATE POLICY "Authenticated users can create order items" ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (true);
