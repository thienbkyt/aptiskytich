CREATE OR REPLACE FUNCTION public.get_exam_questions(_set_ids uuid[])
RETURNS SETOF public.exam_questions
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_day date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_day_sets int := 0;
  v_hour_sets int := 0;
  v_allowed uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _set_ids IS NULL OR array_length(_set_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_admin := has_role(v_uid, 'admin'::app_role);

  IF v_admin THEN
    v_allowed := _set_ids;
  ELSE
    SELECT coalesce(array_agg(es.id), '{}'::uuid[]) INTO v_allowed
    FROM exam_sets es
    WHERE es.id = ANY(_set_ids)
      AND es.is_published = true
      AND (
        tier_rank(user_tier(v_uid)) >= tier_rank(COALESCE(es.access_tier, 'pro'::text))
        OR EXISTS (
          SELECT 1 FROM user_opened_items uoi
          WHERE uoi.user_id = v_uid AND uoi.item_key = es.id::text
        )
      );

    SELECT count(DISTINCT exam_set_id) INTO v_day_sets
    FROM exam_access_log WHERE user_id = v_uid AND day = v_day;

    SELECT count(DISTINCT exam_set_id) INTO v_hour_sets
    FROM exam_access_log WHERE user_id = v_uid AND first_at > now() - interval '60 minutes';

    IF v_day_sets > 250 OR v_hour_sets > 120 THEN
      RAISE EXCEPTION 'exam_access_limit';
    END IF;
  END IF;

  IF array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO exam_access_log (user_id, exam_set_id, day)
  SELECT v_uid, s, v_day FROM unnest(v_allowed) AS s
  ON CONFLICT (user_id, exam_set_id, day)
  DO UPDATE SET hits = exam_access_log.hits + 1;

  RETURN QUERY
  SELECT q.* FROM exam_questions q
  WHERE q.exam_set_id = ANY(v_allowed)
  ORDER BY q.exam_set_id, q.order_index;
END;
$$;

REVOKE ALL ON FUNCTION public.get_exam_questions(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(uuid[]) TO authenticated, service_role;