REVOKE ALL ON public.backup_urbanfarming_de11_20260826 FROM anon, authenticated;
GRANT ALL ON public.backup_urbanfarming_de11_20260826 TO service_role;
ALTER TABLE public.backup_urbanfarming_de11_20260826 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins only" ON public.backup_urbanfarming_de11_20260826;
CREATE POLICY "Admins only" ON public.backup_urbanfarming_de11_20260826 FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));