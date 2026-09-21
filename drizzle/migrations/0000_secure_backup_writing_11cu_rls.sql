ALTER TABLE public.backup_writing_11cu_20260921 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_writing_11cu_20260921 FROM anon;
GRANT SELECT ON public.backup_writing_11cu_20260921 TO authenticated;
GRANT ALL ON public.backup_writing_11cu_20260921 TO service_role;

DROP POLICY IF EXISTS "Admins can manage backup_writing_11cu_20260921" ON public.backup_writing_11cu_20260921;
CREATE POLICY "Admins can manage backup_writing_11cu_20260921"
ON public.backup_writing_11cu_20260921
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));