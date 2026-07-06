DROP POLICY IF EXISTS "auth read items of published keys" ON public.prediction_items;

CREATE POLICY "Premium read prediction_items" ON public.prediction_items
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.prediction_keys k
    WHERE k.id = prediction_items.key_id
      AND k.is_published = true
      AND public.tier_rank(public.current_user_tier()) >= public.tier_rank('premium')
  )
);