
ALTER TABLE public.exam_sets
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'pro';

ALTER TABLE public.exam_sets
  DROP CONSTRAINT IF EXISTS exam_sets_access_tier_chk;
ALTER TABLE public.exam_sets
  ADD CONSTRAINT exam_sets_access_tier_chk CHECK (access_tier IN ('free','pro'));

CREATE INDEX IF NOT EXISTS exam_sets_access_tier_idx ON public.exam_sets(access_tier);

-- Seed: oldest 2 published per (skill, exam_type) become free
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY skill, exam_type ORDER BY created_at ASC) AS rn
    FROM public.exam_sets
   WHERE is_published = true
)
UPDATE public.exam_sets es
   SET access_tier = 'free'
  FROM ranked r
 WHERE es.id = r.id AND r.rn <= 2;
