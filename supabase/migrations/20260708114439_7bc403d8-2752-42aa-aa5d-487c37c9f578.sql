-- Allow public (anon + authenticated) to read blog-images bucket contents
DROP POLICY IF EXISTS "Authenticated read blog images" ON storage.objects;
CREATE POLICY "Public read blog images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'blog-images');