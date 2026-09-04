ALTER TABLE public.backup_rp3_who_20260904 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_rp3_who_20260904 FROM anon, authenticated;
GRANT SELECT ON public.backup_rp3_who_20260904 TO authenticated;
GRANT ALL ON public.backup_rp3_who_20260904 TO service_role;
CREATE POLICY "Admins can view backup_rp3_who_20260904"
ON public.backup_rp3_who_20260904 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));