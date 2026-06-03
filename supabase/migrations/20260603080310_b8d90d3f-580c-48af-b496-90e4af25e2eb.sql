-- 1. Restrict question correct answers to authenticated users
DROP POLICY IF EXISTS "Anyone can read questions" ON public.questions;
CREATE POLICY "Authenticated can read questions" ON public.questions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read exam_questions" ON public.exam_questions;
CREATE POLICY "Authenticated can read exam_questions" ON public.exam_questions
  FOR SELECT TO authenticated USING (true);

-- 2. Fix tts-cache bucket write/update policies (require service_role)
DROP POLICY IF EXISTS "Service role write tts-cache" ON storage.objects;
DROP POLICY IF EXISTS "Service role update tts-cache" ON storage.objects;
CREATE POLICY "Service role write tts-cache" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tts-cache' AND auth.role() = 'service_role');
CREATE POLICY "Service role update tts-cache" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tts-cache' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'tts-cache' AND auth.role() = 'service_role');

-- 3. Restrict bucket listing (revoke broad SELECT) — keep direct file access via known paths/signed URLs
DROP POLICY IF EXISTS "Public read tts-cache" ON storage.objects;
CREATE POLICY "Service role read tts-cache" ON storage.objects
  FOR SELECT USING (bucket_id = 'tts-cache' AND auth.role() = 'service_role');

-- 4. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_db_size_mb() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_storage_size_mb() FROM PUBLIC, anon, authenticated;