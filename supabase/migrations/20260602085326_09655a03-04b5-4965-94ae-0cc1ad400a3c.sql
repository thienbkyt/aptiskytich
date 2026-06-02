
CREATE TABLE public.full_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'aptis',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.full_tests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.full_tests TO authenticated;
GRANT ALL ON public.full_tests TO service_role;

ALTER TABLE public.full_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read full_tests" ON public.full_tests
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert full_tests" ON public.full_tests
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update full_tests" ON public.full_tests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete full_tests" ON public.full_tests
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.full_test_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_test_id uuid NOT NULL REFERENCES public.full_tests(id) ON DELETE CASCADE,
  exam_set_id uuid NOT NULL REFERENCES public.exam_sets(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (full_test_id, exam_set_id)
);

CREATE INDEX idx_full_test_members_test ON public.full_test_members(full_test_id);
CREATE INDEX idx_full_test_members_set ON public.full_test_members(exam_set_id);

GRANT SELECT ON public.full_test_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.full_test_members TO authenticated;
GRANT ALL ON public.full_test_members TO service_role;

ALTER TABLE public.full_test_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read full_test_members" ON public.full_test_members
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert full_test_members" ON public.full_test_members
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete full_test_members" ON public.full_test_members
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update full_test_members" ON public.full_test_members
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing data: each legacy full_test_id with category != null becomes a row in full_tests + members.
-- We reuse the legacy full_test_id as the new full_tests.id so existing URLs / references keep working.
INSERT INTO public.full_tests (id, title, category, is_published, created_at)
SELECT
  es.full_test_id,
  COALESCE(MAX(es.full_test_title), 'Full Test'),
  MAX(es.full_test_category),
  bool_and(es.is_published),
  MIN(es.created_at)
FROM public.exam_sets es
WHERE es.full_test_id IS NOT NULL
  AND es.full_test_category IS NOT NULL
GROUP BY es.full_test_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.full_test_members (full_test_id, exam_set_id)
SELECT es.full_test_id, es.id
FROM public.exam_sets es
WHERE es.full_test_id IS NOT NULL
  AND es.full_test_category IS NOT NULL
ON CONFLICT DO NOTHING;

-- Clear full_test_category on legacy rows so they ALSO show up as Full Part groups
-- in their respective skill (the per-skill Full Part query requires category IS NULL).
UPDATE public.exam_sets
SET full_test_category = NULL
WHERE full_test_category IS NOT NULL;
