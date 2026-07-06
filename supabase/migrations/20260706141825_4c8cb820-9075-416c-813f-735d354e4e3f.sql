-- TASK 1: tier-gate exam_questions
DROP POLICY IF EXISTS "Authenticated can read exam_questions" ON public.exam_questions;

CREATE POLICY "Read exam_questions by tier" ON public.exam_questions
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.exam_sets es
    WHERE es.id = exam_questions.exam_set_id
      AND es.is_published = true
      AND (
        coalesce(es.access_tier, 'free') = 'free'
        OR public.tier_rank(public.current_user_tier()) >= public.tier_rank(es.access_tier)
      )
  )
);

-- TASK 2: storage read policies for authenticated users on audio & exam-images
DROP POLICY IF EXISTS "Authenticated read audio" ON storage.objects;
CREATE POLICY "Authenticated read audio" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'audio');

DROP POLICY IF EXISTS "Authenticated read exam-images" ON storage.objects;
CREATE POLICY "Authenticated read exam-images" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'exam-images');