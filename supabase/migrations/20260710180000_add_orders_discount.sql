-- Cashier-composed offers reduce the invoice total. We only store the final
-- discount amount here — the individual offer types (whole-invoice %, selected
-- items %, get-X-pay-Y) live on the client for the length of the sale and get
-- collapsed into a single number when the order is inserted. Commission
-- stays computed on the pre-discount subtotal so the salesperson isn't
-- penalized by promotions the store chose to run.

ALTER TABLE public.orders
  ADD COLUMN discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
