DROP POLICY "Premium read prediction_items" ON public.prediction_items;
CREATE POLICY "Paid read prediction_items" ON public.prediction_items
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR (EXISTS (
    SELECT 1 FROM prediction_keys k
    WHERE k.id = prediction_items.key_id
      AND k.is_published = true
      AND tier_rank(current_user_tier()) >= tier_rank('pro'::text)
  ))
);