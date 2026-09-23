ALTER TABLE public.backup_de35_p6_20260922 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_de35_p6_20260922 FROM anon, authenticated;
GRANT ALL ON TABLE public.backup_de35_p6_20260922 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.backup_de35_p6_20260922 TO authenticated;
CREATE POLICY "Admins manage backup_de35_p6_20260922"
ON public.backup_de35_p6_20260922
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.backup_de_so_20260923 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_de_so_20260923 FROM anon, authenticated;
GRANT ALL ON TABLE public.backup_de_so_20260923 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.backup_de_so_20260923 TO authenticated;
CREATE POLICY "Admins manage backup_de_so_20260923"
ON public.backup_de_so_20260923
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));