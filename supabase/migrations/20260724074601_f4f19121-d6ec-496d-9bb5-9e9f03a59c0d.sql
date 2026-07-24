
-- 1) Drop duplicate public-role admin policies on storage.objects for audio/exam-images
DROP POLICY IF EXISTS "Admin can delete audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can insert audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can list audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can insert exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete exam images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload exam images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can list exam-images" ON storage.objects;

-- 2) Add missing admin UPDATE + SELECT policies scoped to authenticated
CREATE POLICY "Admins can update audio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audio' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'audio' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update exam-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'exam-images' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'exam-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can list audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can list exam-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exam-images' AND has_role(auth.uid(), 'admin'::app_role));

-- 3) Scope email_send_state policy to service_role explicitly
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state"
  ON public.email_send_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
