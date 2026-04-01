
-- Add full_test_id column to link individual skill exam_sets under a full test group
ALTER TABLE public.exam_sets ADD COLUMN full_test_id uuid DEFAULT NULL;

-- Add full_test_title for display purposes (stores the name of the full test group)
ALTER TABLE public.exam_sets ADD COLUMN full_test_title text DEFAULT NULL;

-- Index for fast lookups
CREATE INDEX idx_exam_sets_full_test_id ON public.exam_sets (full_test_id) WHERE full_test_id IS NOT NULL;
