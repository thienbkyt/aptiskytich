ALTER TABLE public.backup_sp4_20260803 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_sp4_sets_20260803 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_sp4_20260803 FROM anon, authenticated;
REVOKE ALL ON public.backup_sp4_sets_20260803 FROM anon, authenticated;
GRANT SELECT ON public.backup_sp4_20260803 TO authenticated;
GRANT SELECT ON public.backup_sp4_sets_20260803 TO authenticated;
GRANT ALL ON public.backup_sp4_20260803 TO service_role;
GRANT ALL ON public.backup_sp4_sets_20260803 TO service_role;

CREATE POLICY "Admins can view sp4 backup questions"
  ON public.backup_sp4_20260803 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view sp4 backup sets"
  ON public.backup_sp4_sets_20260803 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));