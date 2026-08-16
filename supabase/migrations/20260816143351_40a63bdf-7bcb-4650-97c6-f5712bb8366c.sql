-- Lock down leftover backup tables
ALTER TABLE public.backup_auth_pass_20260815 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_auth_pass_20260815 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_auth_pass_20260815 FROM anon, authenticated;
GRANT ALL ON public.backup_auth_pass_20260815 TO service_role;

ALTER TABLE public.backup_lp2_de09_20260815 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_lp2_de09_20260815 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_lp2_de09_20260815 FROM anon, authenticated;
GRANT ALL ON public.backup_lp2_de09_20260815 TO service_role;

DROP POLICY IF EXISTS "backup_lp2_de09_admin_read" ON public.backup_lp2_de09_20260815;
CREATE POLICY "backup_lp2_de09_admin_read" ON public.backup_lp2_de09_20260815
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));