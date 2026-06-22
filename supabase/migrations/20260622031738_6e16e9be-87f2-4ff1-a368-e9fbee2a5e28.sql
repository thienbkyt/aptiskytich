CREATE TABLE public.sentence_translation_cache (
  text_hash text PRIMARY KEY,
  source_text text NOT NULL,
  translation_vi text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sentence_translation_cache TO service_role;
ALTER TABLE public.sentence_translation_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.sentence_translation_cache FOR ALL USING (false) WITH CHECK (false);