ALTER TABLE public.backup_speaking_p2p3_extra_20260806 ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.backup_speaking_p2p3_extra_20260806 TO authenticated;
GRANT ALL ON public.backup_speaking_p2p3_extra_20260806 TO service_role;

CREATE POLICY "Admins read backup_speaking_p2p3_extra" ON public.backup_speaking_p2p3_extra_20260806
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));