
CREATE TABLE public.reading_review_cache (
  exam_set_id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reading_review_cache TO authenticated;
GRANT ALL ON public.reading_review_cache TO service_role;

ALTER TABLE public.reading_review_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reading review cache"
ON public.reading_review_cache
FOR SELECT
TO authenticated
USING (true);
