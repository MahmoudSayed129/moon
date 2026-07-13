DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp_column();
