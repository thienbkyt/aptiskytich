ALTER TABLE public.exam_sets ADD COLUMN IF NOT EXISTS new_until timestamptz DEFAULT (now() + interval '10 days');
UPDATE public.exam_sets SET new_until = NULL;