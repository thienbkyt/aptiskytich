
CREATE POLICY "Users can read own speaking recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload own speaking recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own speaking recordings"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'speaking-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
