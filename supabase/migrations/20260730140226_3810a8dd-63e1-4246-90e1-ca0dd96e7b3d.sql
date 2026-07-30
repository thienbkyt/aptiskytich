CREATE OR REPLACE FUNCTION public.try_open_item(p_feature text, p_item_key text, p_skill text DEFAULT NULL::text, p_set_ids text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cap int;
  v_used int;
  v_exists boolean;
  v_result jsonb;
  v_open boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'cap', 0, 'already', false);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || p_feature));

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
    v_open := true;
    v_result := jsonb_build_object('allowed', true, 'used', v_used, 'cap', v_cap, 'already', true);
  ELSIF v_used >= v_cap THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_used, 'cap', v_cap, 'already', false);
  ELSE
    INSERT INTO public.user_opened_items (user_id, feature, item_key, skill)
    VALUES (v_uid, p_feature, p_item_key, p_skill)
    ON CONFLICT (user_id, feature, item_key) DO NOTHING;

    v_open := true;
    v_result := jsonb_build_object('allowed', true, 'used', v_used + 1, 'cap', v_cap, 'already', false);
  END IF;

  -- Shared opened_set expansion: server-derived, ignores client-supplied ids
  IF v_open THEN
    IF p_feature = 'full_part' THEN
      INSERT INTO public.user_opened_items (user_id, feature, item_key)
      SELECT v_uid, 'opened_set', es.id::text
      FROM public.exam_sets es
      WHERE es.full_test_id::text = p_item_key AND es.is_published = true
      ON CONFLICT DO NOTHING;

    ELSIF p_feature = 'full_test' THEN
      INSERT INTO public.user_opened_items (user_id, feature, item_key)
      SELECT v_uid, 'opened_set', m.exam_set_id::text
      FROM public.full_test_members m
      WHERE m.full_test_id::text = p_item_key
      ON CONFLICT DO NOTHING;

    ELSIF p_feature = 'marathon' AND p_set_ids IS NOT NULL THEN
      IF (SELECT count(*) FROM public.exam_sets
          WHERE id::text = ANY(p_set_ids) AND is_published = true)
         = cardinality(p_set_ids)
         AND (SELECT count(DISTINCT (lower(skill), part)) FROM public.exam_sets
              WHERE id::text = ANY(p_set_ids)) = 1
      THEN
        INSERT INTO public.user_opened_items (user_id, feature, item_key)
        SELECT v_uid, 'opened_set', s FROM unnest(p_set_ids) s
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN v_result;
END;
$function$;