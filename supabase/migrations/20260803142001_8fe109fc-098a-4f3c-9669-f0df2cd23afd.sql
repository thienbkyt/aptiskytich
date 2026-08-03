REVOKE ALL ON public.backup_sp123_20260803 FROM anon, authenticated;
GRANT ALL ON public.backup_sp123_20260803 TO service_role;
ALTER TABLE public.backup_sp123_20260803 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read backup_sp123_20260803" ON public.backup_sp123_20260803;
GRANT SELECT ON public.backup_sp123_20260803 TO authenticated;
CREATE POLICY "Admins can read backup_sp123_20260803"
ON public.backup_sp123_20260803 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));