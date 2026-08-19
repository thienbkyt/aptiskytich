GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_rp5_de27_20260819 TO authenticated;
GRANT ALL ON public.backup_rp5_de27_20260819 TO service_role;
ALTER TABLE public.backup_rp5_de27_20260819 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage backup_rp5_de27_20260819" ON public.backup_rp5_de27_20260819;
CREATE POLICY "Admins can manage backup_rp5_de27_20260819"
  ON public.backup_rp5_de27_20260819
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_rp5_giaithich_20260819 TO authenticated;
GRANT ALL ON public.backup_rp5_giaithich_20260819 TO service_role;
ALTER TABLE public.backup_rp5_giaithich_20260819 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage backup_rp5_giaithich_20260819" ON public.backup_rp5_giaithich_20260819;
CREATE POLICY "Admins can manage backup_rp5_giaithich_20260819"
  ON public.backup_rp5_giaithich_20260819
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));