REVOKE ALL ON public.backup_eq_p3_truoc_v2_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_eq_p4_truoc_v2_20260805 FROM anon, authenticated;
GRANT SELECT ON public.backup_eq_p3_truoc_v2_20260805 TO authenticated;
GRANT SELECT ON public.backup_eq_p4_truoc_v2_20260805 TO authenticated;
GRANT ALL ON public.backup_eq_p3_truoc_v2_20260805 TO service_role;
GRANT ALL ON public.backup_eq_p4_truoc_v2_20260805 TO service_role;
ALTER TABLE public.backup_eq_p3_truoc_v2_20260805 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_eq_p4_truoc_v2_20260805 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only read backup p3" ON public.backup_eq_p3_truoc_v2_20260805
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins only read backup p4" ON public.backup_eq_p4_truoc_v2_20260805
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));