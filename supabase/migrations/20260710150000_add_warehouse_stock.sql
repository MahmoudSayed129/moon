-- Split product stock into "store" (shop floor, sold at checkout) and
-- "warehouse" (back-of-store). `products.quantity` stays as the store floor
-- number so nothing at checkout has to change; `warehouse_quantity` is new
-- and starts at 0 for legacy rows.

ALTER TABLE public.products
  ADD COLUMN warehouse_quantity INTEGER NOT NULL DEFAULT 0;

-- Tag every history row with which side of the store it happened on so the
-- history view can filter store activity vs warehouse activity. Legacy rows
-- default to 'store' (that's where the app used to log everything).
ALTER TABLE public.history
  ADD COLUMN location TEXT NOT NULL DEFAULT 'store';

ALTER TABLE public.history
  ADD CONSTRAINT history_location_check
  CHECK (location IN ('store', 'warehouse'));

CREATE INDEX history_location_idx ON public.history (location);
