ALTER TABLE public.backup_rp4_4day_exp_20260905 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_rp4_4day_exp_20260905 FROM anon;
GRANT ALL ON public.backup_rp4_4day_exp_20260905 TO service_role;
DROP POLICY IF EXISTS "Admins only" ON public.backup_rp4_4day_exp_20260905;
CREATE POLICY "Admins only" ON public.backup_rp4_4day_exp_20260905
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));