
-- Lock down review caches: only edge functions (service_role) need them
DROP POLICY IF EXISTS "Authenticated users can read reading review cache" ON public.reading_review_cache;
DROP POLICY IF EXISTS "Authenticated users can read listening review cache" ON public.listening_review_cache;
REVOKE SELECT ON public.reading_review_cache FROM authenticated;
REVOKE SELECT ON public.listening_review_cache FROM authenticated;

-- Allow authenticated students to read legacy questions/answers content
DROP POLICY IF EXISTS "Authenticated users can read questions" ON public.questions;
CREATE POLICY "Authenticated users can read questions"
  ON public.questions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read answers" ON public.answers;
CREATE POLICY "Authenticated users can read answers"
  ON public.answers FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.questions TO authenticated;
GRANT SELECT ON public.answers TO authenticated;
