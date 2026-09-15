ALTER TABLE public.backup_grading_jobs_defer2_20260914 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only" ON public.backup_grading_jobs_defer2_20260914
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins only - anon" ON public.backup_grading_jobs_defer2_20260914
  FOR ALL
  TO anon
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));