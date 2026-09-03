ALTER TABLE public.backup_de36_q11_20260903 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_visitcity_20260903 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_de36_q11_20260903 FROM anon;
REVOKE ALL ON public.backup_visitcity_20260903 FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_de36_q11_20260903 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_visitcity_20260903 TO authenticated;
GRANT ALL ON public.backup_de36_q11_20260903 TO service_role;
GRANT ALL ON public.backup_visitcity_20260903 TO service_role;

DROP POLICY IF EXISTS "admin_only_backup_de36_q11_20260903" ON public.backup_de36_q11_20260903;
CREATE POLICY "admin_only_backup_de36_q11_20260903"
ON public.backup_de36_q11_20260903
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_only_backup_visitcity_20260903" ON public.backup_visitcity_20260903;
CREATE POLICY "admin_only_backup_visitcity_20260903"
ON public.backup_visitcity_20260903
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));