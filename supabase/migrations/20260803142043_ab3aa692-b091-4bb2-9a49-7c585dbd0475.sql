REVOKE ALL ON public.backup_prediction_items_20260804 FROM anon, authenticated;
GRANT ALL ON public.backup_prediction_items_20260804 TO service_role;
GRANT SELECT ON public.backup_prediction_items_20260804 TO authenticated;
ALTER TABLE public.backup_prediction_items_20260804 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read backup_prediction_items_20260804" ON public.backup_prediction_items_20260804;
CREATE POLICY "Admins can read backup_prediction_items_20260804"
ON public.backup_prediction_items_20260804 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));