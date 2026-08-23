REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.prediction_items FROM anon;

DROP POLICY IF EXISTS "Public read published prediction_items" ON public.prediction_items;
DROP POLICY IF EXISTS "Paid read prediction_items" ON public.prediction_items;
DROP POLICY IF EXISTS "Premium read prediction_items" ON public.prediction_items;

GRANT SELECT ON public.prediction_items TO authenticated;
GRANT ALL ON public.prediction_items TO service_role;

CREATE POLICY "Paid read prediction_items" ON public.prediction_items
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (
      SELECT 1
      FROM prediction_keys k
      WHERE k.id = prediction_items.key_id
        AND k.is_published = true
        AND tier_rank(current_user_tier()) >= tier_rank('pro'::text)
    )
  )
);