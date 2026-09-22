ALTER TABLE public.backup_lp1_de36_40_20260922 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_lp1_de36_40_20260922 FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.backup_lp1_de36_40_20260922 TO authenticated;
GRANT ALL ON TABLE public.backup_lp1_de36_40_20260922 TO service_role;
CREATE POLICY "Admins can manage backup_lp1_de36_40_20260922"
ON public.backup_lp1_de36_40_20260922
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.backup_de40_truoc_tron_20260922 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_de40_truoc_tron_20260922 FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.backup_de40_truoc_tron_20260922 TO authenticated;
GRANT ALL ON TABLE public.backup_de40_truoc_tron_20260922 TO service_role;
CREATE POLICY "Admins can manage backup_de40_truoc_tron_20260922"
ON public.backup_de40_truoc_tron_20260922
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));