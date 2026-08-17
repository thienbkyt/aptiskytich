DROP POLICY IF EXISTS "Read exam_questions via opened items" ON public.exam_questions;

CREATE POLICY "Read exam_questions via opened items"
ON public.exam_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_opened_items uoi
    JOIN public.exam_sets es ON es.id = exam_questions.exam_set_id
    WHERE uoi.user_id = auth.uid()
      AND uoi.item_key = exam_questions.exam_set_id::text
      AND es.is_published = true
      AND public.tier_rank(public.user_tier(auth.uid())) >= public.tier_rank(COALESCE(es.access_tier, 'pro'))
  )
);