CREATE TABLE public.user_opened_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  item_key text NOT NULL,
  skill text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature, item_key)
);

GRANT SELECT ON public.user_opened_items TO authenticated;
GRANT ALL ON public.user_opened_items TO service_role;

ALTER TABLE public.user_opened_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_opened_items_user_feature ON public.user_opened_items (user_id, feature);

CREATE POLICY "Users can view their own opened items"
ON public.user_opened_items FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all opened items"
ON public.user_opened_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.try_open_item(p_feature text, p_item_key text, p_skill text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cap int;
  v_used int;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'cap', 0, 'already', false);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || p_feature));

  IF p_feature = 'opened_set' THEN
    INSERT INTO public.user_opened_items (user_id, feature, item_key, skill)
    VALUES (v_uid, p_feature, p_item_key, p_skill)
    ON CONFLICT (user_id, feature, item_key) DO NOTHING;
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'cap', -1, 'already', false);
  END IF;

  IF public.promo_active() OR public.tier_rank(public.user_tier(v_uid)) >= public.tier_rank('pro') THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'cap', -1, 'already', false);
  END IF;

  SELECT free_quota INTO v_cap FROM public.feature_flags WHERE key = p_feature;
  IF v_cap IS NULL THEN
    v_cap := CASE p_feature
      WHEN 'exam_bank' THEN 3
      WHEN 'full_part' THEN 3
      WHEN 'full_test' THEN 1
      WHEN 'marathon' THEN 2
      ELSE 0
    END;
  END IF;

  IF p_feature = 'exam_bank' THEN
    SELECT count(*) INTO v_used FROM public.user_opened_items
      WHERE user_id = v_uid AND feature = p_feature AND skill IS NOT DISTINCT FROM p_skill;
  ELSE
    SELECT count(*) INTO v_used FROM public.user_opened_items
      WHERE user_id = v_uid AND feature = p_feature;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_opened_items
    WHERE user_id = v_uid AND feature = p_feature AND item_key = p_item_key
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'cap', v_cap, 'already', true);
  END IF;

  IF v_used >= v_cap THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_used, 'cap', v_cap, 'already', false);
  END IF;

  INSERT INTO public.user_opened_items (user_id, feature, item_key, skill)
  VALUES (v_uid, p_feature, p_item_key, p_skill)
  ON CONFLICT (user_id, feature, item_key) DO NOTHING;

  RETURN jsonb_build_object('allowed', true, 'used', v_used + 1, 'cap', v_cap, 'already', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.try_open_item(text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_open_item(text, text, text) TO authenticated;

CREATE POLICY "Read exam_questions via opened items"
ON public.exam_questions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_opened_items uoi
  JOIN public.exam_sets es ON es.id = exam_questions.exam_set_id
  WHERE uoi.user_id = auth.uid()
    AND uoi.item_key = exam_questions.exam_set_id::text
    AND es.is_published = true
));