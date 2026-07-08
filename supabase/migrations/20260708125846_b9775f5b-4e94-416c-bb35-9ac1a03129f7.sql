-- 1) Remove broad SELECT (listing) policy on public blog-images bucket.
--    Public URLs continue to work because the bucket itself is public.
DROP POLICY IF EXISTS "Public read blog images" ON storage.objects;

-- 2) Remove user_devices from realtime publication to prevent any cross-account
--    metadata broadcast risk. RLS already restricts rows, this is defense-in-depth.
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_devices;