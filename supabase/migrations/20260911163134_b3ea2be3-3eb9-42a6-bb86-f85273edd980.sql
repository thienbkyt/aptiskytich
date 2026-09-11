ALTER TABLE public.backup_de52_de06_20260911 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage backup_de52_de06_20260911" ON public.backup_de52_de06_20260911;
CREATE POLICY "Admins can manage backup_de52_de06_20260911"
ON public.backup_de52_de06_20260911
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));