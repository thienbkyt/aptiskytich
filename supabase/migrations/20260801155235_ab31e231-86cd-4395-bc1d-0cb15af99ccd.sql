CREATE POLICY "Admins can view all speaking recordings"
ON public.speaking_recordings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all speaking recording files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'speaking-recordings' AND public.has_role(auth.uid(), 'admin'));