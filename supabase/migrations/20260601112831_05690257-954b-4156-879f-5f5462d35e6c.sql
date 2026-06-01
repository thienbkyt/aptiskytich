-- Drop existing admin policies if they exist (idempotent)
DROP POLICY IF EXISTS "Admin can select exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can insert exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete exam-images" ON storage.objects;

DROP POLICY IF EXISTS "Admin can select audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can insert audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete audio" ON storage.objects;

-- ============================================
-- Policies for exam-images bucket (admin only)
-- ============================================
CREATE POLICY "Admin can select exam-images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'exam-images'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can insert exam-images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'exam-images'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can update exam-images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'exam-images'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can delete exam-images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'exam-images'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============================================
-- Policies for audio bucket (admin only)
-- ============================================
CREATE POLICY "Admin can select audio"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'audio'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can insert audio"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'audio'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can update audio"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'audio'
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can delete audio"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'audio'
    AND public.has_role(auth.uid(), 'admin')
  );