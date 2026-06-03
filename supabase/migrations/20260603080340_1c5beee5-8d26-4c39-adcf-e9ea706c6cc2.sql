REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- Restrict listing of audio and exam-images buckets (files still accessible by direct URL since buckets are public)
DROP POLICY IF EXISTS "Anyone can read audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read exam images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can select audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can select exam-images" ON storage.objects;

CREATE POLICY "Admins can list audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can list exam-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'exam-images' AND has_role(auth.uid(), 'admin'::app_role));