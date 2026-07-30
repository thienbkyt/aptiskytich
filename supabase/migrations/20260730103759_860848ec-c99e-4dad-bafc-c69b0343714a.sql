CREATE OR REPLACE FUNCTION public.open_sets_bulk(p_set_ids text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.promo_active() OR public.tier_rank(public.user_tier(v_uid)) >= public.tier_rank('pro') THEN
    RETURN true;
  END IF;

  IF p_set_ids IS NULL OR array_length(p_set_ids, 1) IS NULL THEN
    RETURN true;
  END IF;

  INSERT INTO public.user_opened_items (user_id, feature, item_key)
  SELECT v_uid, 'opened_set', s
  FROM unnest(p_set_ids) AS s
  WHERE s IS NOT NULL AND s <> ''
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.open_sets_bulk(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_sets_bulk(text[]) TO authenticated;