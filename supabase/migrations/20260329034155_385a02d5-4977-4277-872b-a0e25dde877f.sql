CREATE TABLE IF NOT EXISTS public.dictionary_cache (
  word text PRIMARY KEY,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dictionary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dictionary cache"
  ON public.dictionary_cache
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can insert cache"
  ON public.dictionary_cache
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role')