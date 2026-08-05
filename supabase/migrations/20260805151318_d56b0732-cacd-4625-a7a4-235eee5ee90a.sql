-- Lock down leftover backup snapshot tables: admin-only, no public exposure.
ALTER TABLE public.backup_key_policies_20260805 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_sp4_outline_full_20260805 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_sp4_outline_20260805 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_wsr_baochan_c5721b48 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_key_policies_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_sp4_outline_full_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_sp4_outline_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_wsr_baochan_c5721b48 FROM anon, authenticated;

GRANT ALL ON public.backup_key_policies_20260805 TO service_role;
GRANT ALL ON public.backup_sp4_outline_full_20260805 TO service_role;
GRANT ALL ON public.backup_sp4_outline_20260805 TO service_role;
GRANT ALL ON public.backup_wsr_baochan_c5721b48 TO service_role;

GRANT SELECT ON public.backup_key_policies_20260805 TO authenticated;
GRANT SELECT ON public.backup_sp4_outline_full_20260805 TO authenticated;
GRANT SELECT ON public.backup_sp4_outline_20260805 TO authenticated;
GRANT SELECT ON public.backup_wsr_baochan_c5721b48 TO authenticated;

CREATE POLICY "Admins read backup_key_policies" ON public.backup_key_policies_20260805
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read backup_sp4_outline_full" ON public.backup_sp4_outline_full_20260805
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read backup_sp4_outline" ON public.backup_sp4_outline_20260805
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read backup_wsr_baochan" ON public.backup_wsr_baochan_c5721b48
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));