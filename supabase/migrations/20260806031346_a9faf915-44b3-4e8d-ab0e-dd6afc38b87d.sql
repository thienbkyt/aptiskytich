CREATE OR REPLACE FUNCTION public.user_tier(p_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tier text;
BEGIN
  IF p_uid IS NULL THEN RETURN 'free'; END IF;
  IF public.promo_active() THEN RETURN 'premium'; END IF;
  SELECT tier INTO v_tier
    FROM public.user_subscriptions
   WHERE user_id = p_uid
     AND tier IN ('pro','premium')
     AND (pro_until IS NULL OR pro_until > now())
   LIMIT 1;
  RETURN COALESCE(v_tier, 'free');
END;
$function$;

DROP POLICY IF EXISTS "Read exam_questions by tier" ON public.exam_questions;
CREATE POLICY "Read exam_questions by tier"
ON public.exam_questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.exam_sets es
    WHERE es.id = exam_questions.exam_set_id
      AND es.is_published = true
      AND tier_rank(user_tier(auth.uid())) >= tier_rank(COALESCE(es.access_tier, 'pro'::text))
  )
);