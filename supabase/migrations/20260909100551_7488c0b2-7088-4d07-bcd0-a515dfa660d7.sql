ALTER TABLE public.backup_p3_options_20260909 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_musician_20260909 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_p3_options_20260909 FROM anon, authenticated;
REVOKE ALL ON public.backup_musician_20260909 FROM anon, authenticated;
GRANT ALL ON public.backup_p3_options_20260909 TO service_role;
GRANT ALL ON public.backup_musician_20260909 TO service_role;
GRANT SELECT ON public.backup_p3_options_20260909 TO authenticated;
GRANT SELECT ON public.backup_musician_20260909 TO authenticated;

DROP POLICY IF EXISTS "Admins only" ON public.backup_p3_options_20260909;
CREATE POLICY "Admins only" ON public.backup_p3_options_20260909
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins only" ON public.backup_musician_20260909;
CREATE POLICY "Admins only" ON public.backup_musician_20260909
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));