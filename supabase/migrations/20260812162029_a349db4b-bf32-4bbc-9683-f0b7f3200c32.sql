DROP POLICY IF EXISTS feedback_images_auth_read ON storage.objects;
DROP POLICY IF EXISTS feedback_images_auth_insert ON storage.objects;

CREATE POLICY feedback_images_auth_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'feedback-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY feedback_images_auth_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'feedback-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.student_feedback sf
      WHERE sf.score_image_url = storage.objects.name
        AND sf.is_approved = true
    )
  )
);