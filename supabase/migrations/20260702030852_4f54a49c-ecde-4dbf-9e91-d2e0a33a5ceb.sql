ALTER TABLE public.exam_sets ADD COLUMN IF NOT EXISTS key_date text;
CREATE INDEX IF NOT EXISTS idx_exam_sets_key_date ON public.exam_sets(key_date);