ALTER TABLE public.history
DROP CONSTRAINT IF EXISTS history_operation_check;

ALTER TABLE public.history
ADD CONSTRAINT history_operation_check
CHECK (operation IN ('add', 'take', 'return'));
