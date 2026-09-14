-- ROLLBACK REFERENCE (recreate the two dropped SELECT policies):
-- CREATE POLICY "Read exam_questions by tier" ON public.exam_questions FOR SELECT USING (
--   has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1 FROM exam_sets es
--     WHERE es.id = exam_questions.exam_set_id AND es.is_published = true
--       AND tier_rank(user_tier(auth.uid())) >= tier_rank(COALESCE(es.access_tier, 'pro'::text)))));
-- CREATE POLICY "Read exam_questions via opened items" ON public.exam_questions FOR SELECT USING (
--   EXISTS ( SELECT 1 FROM user_opened_items uoi JOIN exam_sets es ON es.id = exam_questions.exam_set_id
--     WHERE uoi.user_id = auth.uid() AND uoi.item_key = (exam_questions.exam_set_id)::text AND es.is_published = true));

CREATE TABLE IF NOT EXISTS public.exam_access_log (
  user_id uuid NOT NULL,
  exam_set_id uuid NOT NULL,
  day date NOT NULL,
  first_at timestamptz NOT NULL DEFAULT now(),
  hits int NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, exam_set_id, day)
);

GRANT SELECT ON public.exam_access_log TO authenticated;
GRANT ALL ON public.exam_access_log TO service_role;
ALTER TABLE public.exam_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read exam_access_log" ON public.exam_access_log;
CREATE POLICY "Admins can read exam_access_log" ON public.exam_access_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS exam_access_log_user_first_at_idx ON public.exam_access_log (user_id, first_at DESC);
CREATE INDEX IF NOT EXISTS exam_access_log_day_idx ON public.exam_access_log (day DESC);

CREATE OR REPLACE FUNCTION public.get_exam_questions(_set_ids uuid[])
RETURNS SETOF public.exam_questions
LANGUAGE plpgsql
STABLE
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

CREATE OR REPLACE FUNCTION public.get_exam_access_alerts()
RETURNS TABLE(user_id uuid, email text, day date, set_count int, submissions int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT l.user_id,
         u.email::text,
         l.day,
         count(DISTINCT l.exam_set_id)::int AS set_count,
         (
           SELECT count(*)::int FROM test_results tr
           WHERE tr.user_id = l.user_id
             AND (tr.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = l.day
         ) AS submissions
  FROM exam_access_log l
  JOIN auth.users u ON u.id = l.user_id
  WHERE l.day >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 7
  GROUP BY l.user_id, u.email, l.day
  HAVING count(DISTINCT l.exam_set_id) > 100
  ORDER BY count(DISTINCT l.exam_set_id) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_exam_access_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_access_alerts() TO authenticated, service_role;

DROP POLICY IF EXISTS "Read exam_questions by tier" ON public.exam_questions;
DROP POLICY IF EXISTS "Read exam_questions via opened items" ON public.exam_questions;

DROP POLICY IF EXISTS "Admins can read exam_questions" ON public.exam_questions;
CREATE POLICY "Admins can read exam_questions" ON public.exam_questions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));