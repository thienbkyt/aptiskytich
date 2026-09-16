ALTER TABLE public.backup_de21_internet_20260915 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only" ON public.backup_de21_internet_20260915
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.tmp_cham_ca_0916 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only" ON public.tmp_cham_ca_0916
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.tmp_cham_ten_0916 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only" ON public.tmp_cham_ten_0916
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));