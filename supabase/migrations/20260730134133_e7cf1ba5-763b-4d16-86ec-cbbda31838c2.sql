DROP FUNCTION IF EXISTS public.try_open_item(text, text, text);

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
    IF p_set_ids IS NOT NULL THEN
      INSERT INTO public.user_opened_items (user_id, feature, item_key)
      SELECT v_uid, 'opened_set', s FROM unnest(p_set_ids) s
      WHERE s IS NOT NULL AND s <> ''
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'cap', v_cap, 'already', true);
  END IF;

  IF v_used >= v_cap THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_used, 'cap', v_cap, 'already', false);
  END IF;

  INSERT INTO public.user_opened_items (user_id, feature, item_key, skill)
  VALUES (v_uid, p_feature, p_item_key, p_skill)
  ON CONFLICT (user_id, feature, item_key) DO NOTHING;

  IF p_set_ids IS NOT NULL THEN
    INSERT INTO public.user_opened_items (user_id, feature, item_key)
    SELECT v_uid, 'opened_set', s FROM unnest(p_set_ids) s
    WHERE s IS NOT NULL AND s <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'used', v_used + 1, 'cap', v_cap, 'already', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.try_open_item(text, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.try_open_item(text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_open_item(text, text, text, text[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.open_sets_bulk(text[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.open_sets_bulk(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_sets_bulk(text[]) TO service_role;