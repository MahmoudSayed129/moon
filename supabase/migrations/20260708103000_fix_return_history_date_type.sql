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
      CURRENT_DATE,
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
