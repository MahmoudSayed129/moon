-- Traders (suppliers) + wholesale cost per product.
-- Mirrors the categories pattern: name-unique table, permissive RLS (app enforces
-- super_admin gating), timestamp trigger via update_product_timestamp().

CREATE TABLE public.traders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  phone text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.traders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view traders"
ON public.traders
FOR SELECT
USING (true);

CREATE POLICY "Super admins can manage traders"
ON public.traders
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_traders_updated_at
BEFORE UPDATE ON public.traders
FOR EACH ROW
EXECUTE FUNCTION public.update_product_timestamp();

-- Link products to a trader and store the wholesale cost that trader charged.
-- Both are nullable so existing rows keep working; new products can leave the
-- trader blank if the user hasn't set them up yet.
ALTER TABLE public.products
  ADD COLUMN trader_id uuid REFERENCES public.traders(id) ON DELETE SET NULL,
  ADD COLUMN cost_price numeric(10, 2);

CREATE INDEX products_trader_id_idx ON public.products (trader_id);
