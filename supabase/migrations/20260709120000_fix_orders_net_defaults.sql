UPDATE public.orders
SET
  returned_subtotal = 0,
  returned_commission_amount = 0,
  returned_total_amount = 0,
  net_subtotal = subtotal,
  net_commission_amount = commission_amount,
  net_total_amount = total_amount,
  has_return = false,
  return_count = 0,
  return_status = 'none'
WHERE COALESCE(has_return, false) = false
  AND COALESCE(return_status, 'none') = 'none';
