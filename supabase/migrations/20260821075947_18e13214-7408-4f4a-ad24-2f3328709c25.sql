DROP POLICY IF EXISTS "Anyone can read dictionary cache" ON public.dictionary_cache;

CREATE POLICY "Authenticated can read dictionary cache"
  ON public.dictionary_cache
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.dictionary_cache FROM anon;
GRANT SELECT ON public.dictionary_cache TO authenticated;
GRANT ALL ON public.dictionary_cache TO service_role;