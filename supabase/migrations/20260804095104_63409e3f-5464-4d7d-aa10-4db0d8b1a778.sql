DROP TABLE IF EXISTS public.backup_prediction_items_20260804;
DROP TABLE IF EXISTS public.backup_sp123_20260803;
DROP TABLE IF EXISTS public.backup_sp4_20260803;
DROP TABLE IF EXISTS public.backup_sp4_sets_20260803;

DROP POLICY IF EXISTS "Read exam_questions by tier" ON public.exam_questions;
CREATE POLICY "Read exam_questions by tier"
ON public.exam_questions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.exam_sets es
    WHERE es.id = exam_questions.exam_set_id
      AND es.is_published = true
      AND (
        COALESCE(es.access_tier, 'pro'::text) = 'free'::text
        OR tier_rank(current_user_tier()) >= tier_rank(COALESCE(es.access_tier, 'pro'::text))
      )
  )
);