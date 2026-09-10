ALTER TABLE public.backup_de39_s3_20260909 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backup_de39_s3_20260909"
ON public.backup_de39_s3_20260909
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));