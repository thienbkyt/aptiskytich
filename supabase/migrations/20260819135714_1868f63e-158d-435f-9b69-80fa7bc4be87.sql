ALTER TABLE public.backup_lp2_de32_20260819 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_lp2_de32_20260819 FROM anon, authenticated;
GRANT ALL ON public.backup_lp2_de32_20260819 TO service_role;
DROP POLICY IF EXISTS "Admins can manage backup_lp2_de32_20260819" ON public.backup_lp2_de32_20260819;
CREATE POLICY "Admins can manage backup_lp2_de32_20260819"
ON public.backup_lp2_de32_20260819 FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Restrict client updates on test_results to snapshot/payload columns only (column-level grants)
REVOKE UPDATE ON public.test_results FROM authenticated;
GRANT UPDATE (review_snapshot, grade_payload) ON public.test_results TO authenticated;
GRANT ALL ON public.test_results TO service_role;