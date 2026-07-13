ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS has_returns BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS returns_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_returned_at TIMESTAMPTZ;

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
DROP CONSTRAINT IF EXISTS order_items_returned_quantity_check;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_returned_quantity_check
CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS returned_subtotal NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS returned_commission_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS returned_total_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS net_subtotal NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS net_commission_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS net_total_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS has_return BOOLEAN,
ADD COLUMN IF NOT EXISTS return_count INTEGER,
ADD COLUMN IF NOT EXISTS last_returned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS return_status TEXT;

UPDATE public.orders
SET
  returned_subtotal = COALESCE(returned_subtotal, 0),
  returned_commission_amount = COALESCE(returned_commission_amount, 0),
  returned_total_amount = COALESCE(returned_total_amount, 0),
  net_subtotal = COALESCE(net_subtotal, subtotal),
  net_commission_amount = COALESCE(net_commission_amount, commission_amount),
  net_total_amount = COALESCE(net_total_amount, total_amount),
  has_return = COALESCE(has_return, false),
  return_count = COALESCE(return_count, 0),
  return_status = COALESCE(return_status, 'none');

ALTER TABLE public.orders
ALTER COLUMN returned_subtotal SET DEFAULT 0,
ALTER COLUMN returned_commission_amount SET DEFAULT 0,
ALTER COLUMN returned_total_amount SET DEFAULT 0,
ALTER COLUMN net_subtotal SET DEFAULT 0,
ALTER COLUMN net_commission_amount SET DEFAULT 0,
ALTER COLUMN net_total_amount SET DEFAULT 0,
ALTER COLUMN has_return SET DEFAULT false,
ALTER COLUMN return_count SET DEFAULT 0,
ALTER COLUMN return_status SET DEFAULT 'none';

ALTER TABLE public.orders
ALTER COLUMN returned_subtotal SET NOT NULL,
ALTER COLUMN returned_commission_amount SET NOT NULL,
ALTER COLUMN returned_total_amount SET NOT NULL,
ALTER COLUMN net_subtotal SET NOT NULL,
ALTER COLUMN net_commission_amount SET NOT NULL,
ALTER COLUMN net_total_amount SET NOT NULL,
ALTER COLUMN has_return SET NOT NULL,
ALTER COLUMN return_count SET NOT NULL,
ALTER COLUMN return_status SET NOT NULL;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_return_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_return_status_check
CHECK (return_status IN ('none', 'partial', 'full'));

CREATE TABLE IF NOT EXISTS public.order_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  processed_by_auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  subtotal_returned NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_returned NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_returned NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.order_returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_barcode TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view order returns" ON public.order_returns;
CREATE POLICY "Authenticated users can view order returns" ON public.order_returns
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Managers can create order returns" ON public.order_returns;
CREATE POLICY "Managers can create order returns" ON public.order_returns
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['super_admin'::user_role, 'supervisor'::user_role]
  )
);

DROP POLICY IF EXISTS "Authenticated users can view order return items" ON public.order_return_items;
CREATE POLICY "Authenticated users can view order return items" ON public.order_return_items
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Managers can create order return items" ON public.order_return_items;
CREATE POLICY "Managers can create order return items" ON public.order_return_items
FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['super_admin'::user_role, 'supervisor'::user_role]
  )
);

CREATE OR REPLACE FUNCTION public.process_order_return(
  p_order_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_order public.orders%ROWTYPE;
  v_order_item public.order_items%ROWTYPE;
  v_return_id UUID;
  v_item JSONB;
  v_requested_quantity INTEGER;
  v_available_quantity INTEGER;
  v_line_total NUMERIC(10,2);
  v_subtotal_returned NUMERIC(10,2) := 0;
  v_commission_returned NUMERIC(10,2) := 0;
  v_total_returned NUMERIC(10,2) := 0;
  v_return_status TEXT := 'none';
BEGIN
  v_role := public.get_user_role(auth.uid());

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to process returns';
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'supervisor') THEN
    RAISE EXCEPTION 'Only managers can process returns';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Select at least one item to return';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.created_at < (now() - INTERVAL '14 days') THEN
    RAISE EXCEPTION 'The 14-day return window has expired for this invoice';
  END IF;

  INSERT INTO public.order_returns (
    order_id,
    client_id,
    processed_by_auth_id,
    reason
  )
  VALUES (
    v_order.id,
    v_order.client_id,
    auth.uid(),
    NULLIF(trim(COALESCE(p_reason, '')), '')
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_requested_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);

    IF v_requested_quantity <= 0 THEN
      RAISE EXCEPTION 'Return quantity must be greater than zero';
    END IF;

    SELECT *
    INTO v_order_item
    FROM public.order_items
    WHERE id = (v_item ->> 'order_item_id')::UUID
      AND order_id = v_order.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the selected invoice items was not found';
    END IF;

    v_available_quantity := v_order_item.quantity - COALESCE(v_order_item.returned_quantity, 0);

    IF v_requested_quantity > v_available_quantity THEN
      RAISE EXCEPTION 'Return quantity exceeds the remaining returnable quantity for %', v_order_item.product_name;
    END IF;

    UPDATE public.order_items
    SET returned_quantity = returned_quantity + v_requested_quantity
    WHERE id = v_order_item.id;

    IF v_order_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET quantity = quantity + v_requested_quantity
      WHERE id = v_order_item.product_id;
    END IF;

    v_line_total := ROUND((v_order_item.unit_price * v_requested_quantity)::NUMERIC, 2);
    v_subtotal_returned := v_subtotal_returned + v_line_total;

    INSERT INTO public.order_return_items (
      return_id,
      order_item_id,
      product_id,
      product_name,
      product_barcode,
      quantity,
      unit_price,
      line_total
    )
    VALUES (
      v_return_id,
      v_order_item.id,
      v_order_item.product_id,
      v_order_item.product_name,
      v_order_item.product_barcode,
      v_requested_quantity,
      v_order_item.unit_price,
      v_line_total
    );

    INSERT INTO public.history (
      product_id,
      product_name,
      barcode,
      operation,
      quantity,
      date,
      time
    )
    VALUES (
      v_order_item.product_id,
      v_order_item.product_name,
      v_order_item.product_barcode,
      'return',
      v_requested_quantity,
      CURRENT_DATE::TEXT,
      to_char(LOCALTIME, 'HH24:MI:SS')
    );

    INSERT INTO public.sales (
      product_id,
      product_name,
      quantity,
      unit_price,
      total_amount
    )
    VALUES (
      v_order_item.product_id,
      v_order_item.product_name,
      v_requested_quantity * -1,
      v_order_item.unit_price,
      v_line_total * -1
    );
  END LOOP;

  v_subtotal_returned := ROUND(v_subtotal_returned, 2);
  v_commission_returned := ROUND((v_subtotal_returned * (v_order.commission_rate / 100))::NUMERIC, 2);
  v_total_returned := v_subtotal_returned;

  UPDATE public.order_returns
  SET
    subtotal_returned = v_subtotal_returned,
    commission_returned = v_commission_returned,
    total_returned = v_total_returned
  WHERE id = v_return_id;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.order_items
      WHERE order_id = v_order.id
        AND COALESCE(returned_quantity, 0) < quantity
    ) THEN 'partial'
    ELSE 'full'
  END
  INTO v_return_status;

  UPDATE public.orders
  SET
    returned_subtotal = returned_subtotal + v_subtotal_returned,
    returned_commission_amount = returned_commission_amount + v_commission_returned,
    returned_total_amount = returned_total_amount + v_total_returned,
    net_subtotal = subtotal - (returned_subtotal + v_subtotal_returned),
    net_commission_amount = commission_amount - (returned_commission_amount + v_commission_returned),
    net_total_amount = total_amount - (returned_total_amount + v_total_returned),
    has_return = true,
    return_count = return_count + 1,
    last_returned_at = now(),
    return_status = v_return_status
  WHERE id = v_order.id;

  IF v_order.client_id IS NOT NULL THEN
    UPDATE public.clients
    SET
      has_returns = true,
      returns_count = returns_count + 1,
      last_returned_at = now()
    WHERE id = v_order.client_id;
  END IF;

  RETURN jsonb_build_object(
    'return_id', v_return_id,
    'order_id', v_order.id,
    'subtotal_returned', v_subtotal_returned,
    'commission_returned', v_commission_returned,
    'total_returned', v_total_returned,
    'return_status', v_return_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_order_return(UUID, JSONB, TEXT) TO authenticated;
