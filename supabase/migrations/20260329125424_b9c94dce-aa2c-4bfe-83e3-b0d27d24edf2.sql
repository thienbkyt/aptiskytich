
-- Fix: Drop duplicate policies then recreate
DROP POLICY IF EXISTS "Admins can upload audio" ON storage.objects;
CREATE POLICY "Admins can upload audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can upload exam-images" ON storage.objects;
CREATE POLICY "Admins can upload exam-images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete audio" ON storage.objects;
CREATE POLICY "Admins can delete audio" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete exam-images" ON storage.objects;
CREATE POLICY "Admins can delete exam-images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'exam-images' AND public.has_role(auth.uid(), 'admin'));
