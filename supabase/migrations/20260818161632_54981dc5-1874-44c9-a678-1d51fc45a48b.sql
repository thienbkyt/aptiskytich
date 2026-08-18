REVOKE ALL ON public.backup_wp2_bookclub_20260817 FROM anon, authenticated;
GRANT ALL ON public.backup_wp2_bookclub_20260817 TO service_role;
ALTER TABLE public.backup_wp2_bookclub_20260817 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view bookclub backup"
ON public.backup_wp2_bookclub_20260817
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));