
-- 1) Missing RLS policy so admins can read all learning_streaks
DROP POLICY IF EXISTS "Admins can read all streaks" ON public.learning_streaks;
CREATE POLICY "Admins can read all streaks" ON public.learning_streaks
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) admin_activity_summary
CREATE OR REPLACE FUNCTION public.admin_activity_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_today_start timestamptz := (date_trunc('day', v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_span interval;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
  v_total_users int;
  v_new_users int;
  v_new_users_prev int := 0;
  v_dau int;
  v_wau int;
  v_mau int;
  v_visits_today int;
  v_consistent int;
  v_revenue_period bigint;
  v_revenue_all bigint;
  v_paying int;
  v_pro int;
  v_premium int;
  v_orders int;
  v_expiring int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_from IS NOT NULL THEN
    v_span := COALESCE(p_to, v_now) - p_from;
    v_prev_from := p_from - v_span;
    v_prev_to := p_from;
  END IF;

  SELECT count(*) INTO v_total_users FROM public.profiles;

  SELECT count(*) INTO v_new_users
    FROM public.profiles
   WHERE (p_from IS NULL OR created_at >= p_from)
     AND (p_to IS NULL OR created_at <= p_to);

  IF p_from IS NOT NULL THEN
    SELECT count(*) INTO v_new_users_prev
      FROM public.profiles
     WHERE created_at >= v_prev_from AND created_at < v_prev_to;
  END IF;

  SELECT count(DISTINCT user_id) INTO v_dau
    FROM public.test_results
   WHERE created_at >= v_today_start;

  SELECT count(DISTINCT user_id) INTO v_wau
    FROM public.test_results
   WHERE created_at >= v_now - interval '7 days';

  SELECT count(DISTINCT user_id) INTO v_mau
    FROM public.test_results
   WHERE created_at >= v_now - interval '30 days';

  SELECT count(*) INTO v_visits_today
    FROM public.site_visits
   WHERE created_at >= v_today_start;

  SELECT count(*) INTO v_consistent
    FROM public.learning_streaks
   WHERE COALESCE(current_streak, 0) >= 7;

  SELECT COALESCE(SUM(amount_vnd),0) INTO v_revenue_period
    FROM public.payments
   WHERE status = 'paid'
     AND (p_from IS NULL OR paid_at >= p_from)
     AND (p_to IS NULL OR paid_at <= p_to);

  SELECT COALESCE(SUM(amount_vnd),0) INTO v_revenue_all
    FROM public.payments WHERE status = 'paid';

  SELECT count(*) INTO v_orders
    FROM public.payments
   WHERE status = 'paid'
     AND (p_from IS NULL OR paid_at >= p_from)
     AND (p_to IS NULL OR paid_at <= p_to);

  SELECT
    count(*) FILTER (WHERE tier IN ('pro','premium') AND (pro_until IS NULL OR pro_until > v_now)),
    count(*) FILTER (WHERE tier = 'pro' AND (pro_until IS NULL OR pro_until > v_now)),
    count(*) FILTER (WHERE tier = 'premium' AND (pro_until IS NULL OR pro_until > v_now)),
    count(*) FILTER (WHERE tier = 'pro' AND pro_until IS NOT NULL AND pro_until > v_now AND pro_until <= v_now + interval '7 days')
    INTO v_paying, v_pro, v_premium, v_expiring
    FROM public.user_subscriptions;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'new_users', v_new_users,
    'new_users_prev', v_new_users_prev,
    'dau', v_dau, 'wau', v_wau, 'mau', v_mau,
    'visits_today', v_visits_today,
    'consistent_users', v_consistent,
    'revenue_period', v_revenue_period,
    'revenue_all_time', v_revenue_all,
    'paying_count', v_paying,
    'pro_count', v_pro,
    'premium_count', v_premium,
    'orders_period', v_orders,
    'expiring_soon', v_expiring,
    'top_plans', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.revenue) DESC)
      FROM (
        SELECT COALESCE(plan_key,'(không rõ)') AS plan_key,
               count(*) AS orders,
               COALESCE(SUM(amount_vnd),0)::bigint AS revenue
        FROM public.payments
        WHERE status = 'paid'
          AND (p_from IS NULL OR paid_at >= p_from)
          AND (p_to IS NULL OR paid_at <= p_to)
        GROUP BY 1
      ) x
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_activity_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activity_summary(timestamptz, timestamptz) TO authenticated;

-- 3) admin_activity_daily
CREATE OR REPLACE FUNCTION public.admin_activity_daily(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(day date, new_users int, learners int, revenue bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from timestamptz := COALESCE(p_from, now() - interval '90 days');
  v_to timestamptz := COALESCE(p_to, now());
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (v_from AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
      (v_to   AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
      '1 day'::interval
    )::date AS d
  ),
  new_u AS (
    SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d, count(*) AS c
    FROM public.profiles
    WHERE created_at >= v_from AND created_at <= v_to
    GROUP BY 1
  ),
  learn AS (
    SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d, count(DISTINCT user_id) AS c
    FROM public.test_results
    WHERE created_at >= v_from AND created_at <= v_to
    GROUP BY 1
  ),
  rev AS (
    SELECT (paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d, COALESCE(SUM(amount_vnd),0)::bigint AS c
    FROM public.payments
    WHERE status = 'paid' AND paid_at IS NOT NULL AND paid_at >= v_from AND paid_at <= v_to
    GROUP BY 1
  )
  SELECT days.d,
         COALESCE(new_u.c, 0)::int,
         COALESCE(learn.c, 0)::int,
         COALESCE(rev.c, 0)::bigint
  FROM days
  LEFT JOIN new_u ON new_u.d = days.d
  LEFT JOIN learn ON learn.d = days.d
  LEFT JOIN rev   ON rev.d = days.d
  ORDER BY days.d;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_activity_daily(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activity_daily(timestamptz, timestamptz) TO authenticated;

-- 4) admin_streak_distribution
CREATE OR REPLACE FUNCTION public.admin_streak_distribution()
RETURNS TABLE(bucket text, "count" int)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT COALESCE(current_streak, 0) AS v FROM public.learning_streaks
  ),
  b AS (
    SELECT CASE
      WHEN v = 0 THEN '0'
      WHEN v BETWEEN 1 AND 2 THEN '1–2'
      WHEN v BETWEEN 3 AND 6 THEN '3–6'
      WHEN v BETWEEN 7 AND 13 THEN '7–13'
      ELSE '14+'
    END AS bucket
    FROM s
  ),
  labels(bucket, sort_order) AS (
    VALUES ('0',1),('1–2',2),('3–6',3),('7–13',4),('14+',5)
  )
  SELECT labels.bucket,
         COALESCE(count(b.bucket), 0)::int
  FROM labels LEFT JOIN b ON b.bucket = labels.bucket
  GROUP BY labels.bucket, labels.sort_order
  ORDER BY labels.sort_order;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_streak_distribution() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_streak_distribution() TO authenticated;

-- 5) admin_cost_summary
CREATE OR REPLACE FUNCTION public.admin_cost_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_total numeric := 0;
  v_inv int := 0;
  v_prev_total numeric := 0;
  v_span interval;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_from IS NOT NULL THEN
    v_span := COALESCE(p_to, v_now) - p_from;
    v_prev_from := p_from - v_span;
    v_prev_to := p_from;
  END IF;

  SELECT COALESCE(SUM(estimated_cost_vnd),0), count(*)
    INTO v_total, v_inv
    FROM public.usage_events
   WHERE (p_from IS NULL OR created_at >= p_from)
     AND (p_to IS NULL OR created_at <= p_to);

  IF p_from IS NOT NULL THEN
    SELECT COALESCE(SUM(estimated_cost_vnd),0) INTO v_prev_total
      FROM public.usage_events
     WHERE created_at >= v_prev_from AND created_at < v_prev_to;
  END IF;

  RETURN jsonb_build_object(
    'total_cost', v_total,
    'invocations', v_inv,
    'prev_total_cost', v_prev_total,
    'has_prev', p_from IS NOT NULL,
    'by_service', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.cost) DESC)
      FROM (
        SELECT service,
               COALESCE(SUM(estimated_cost_vnd),0)::numeric AS cost,
               COALESCE(SUM(units),0)::numeric AS units,
               array_to_string(array_agg(DISTINCT unit_type), ', ') AS unit_types,
               count(*)::int AS invocations
        FROM public.usage_events
        WHERE (p_from IS NULL OR created_at >= p_from)
          AND (p_to IS NULL OR created_at <= p_to)
        GROUP BY service
      ) x
    ), '[]'::jsonb),
    'by_model', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.cost) DESC)
      FROM (
        SELECT COALESCE(model,'(unknown)') AS model,
               service,
               COALESCE(SUM(estimated_cost_vnd),0)::numeric AS cost,
               count(*)::int AS invocations
        FROM public.usage_events
        WHERE (p_from IS NULL OR created_at >= p_from)
          AND (p_to IS NULL OR created_at <= p_to)
        GROUP BY service, model
      ) x
    ), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.day) DESC)
      FROM (
        SELECT to_char((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
               service,
               COALESCE(SUM(estimated_cost_vnd),0)::numeric AS cost
        FROM public.usage_events
        WHERE (p_from IS NULL OR created_at >= p_from)
          AND (p_to IS NULL OR created_at <= p_to)
        GROUP BY 1, service
      ) x
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_cost_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cost_summary(timestamptz, timestamptz) TO authenticated;

-- 5b) admin_cost_by_month(year)
CREATE OR REPLACE FUNCTION public.admin_cost_by_month(p_year int)
RETURNS TABLE(month int, service text, cost numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS month,
    service::text,
    COALESCE(SUM(estimated_cost_vnd),0)::numeric AS cost
  FROM public.usage_events
  WHERE created_at >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Asia/Ho_Chi_Minh')
    AND created_at <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Asia/Ho_Chi_Minh')
  GROUP BY 1, 2;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_cost_by_month(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cost_by_month(int) TO authenticated;

-- 5c) admin_cost_available_years
CREATE OR REPLACE FUNCTION public.admin_cost_available_years()
RETURNS TABLE(year int)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT DISTINCT EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int
  FROM public.usage_events
  ORDER BY 1 DESC;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_cost_available_years() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cost_available_years() TO authenticated;

-- 6) admin_outcomes
CREATE OR REPLACE FUNCTION public.admin_outcomes(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN (
    WITH attempts AS (
      SELECT
        user_id,
        CASE
          WHEN skill_scores->>'skill' = 'reading' THEN 'reading'
          WHEN skill_scores->>'skill' = 'listening' THEN 'listening'
          WHEN skill_scores->>'skill' IN ('grammar','grammar_vocab') THEN 'grammar'
          ELSE NULL
        END AS skill,
        CASE
          WHEN (skill_scores->>'total') IS NOT NULL
           AND (skill_scores->>'total')::numeric > 0
            THEN ROUND(((skill_scores->>'correct')::numeric / (skill_scores->>'total')::numeric) * 50)::numeric
          ELSE NULL
        END AS scaled,
        NULL::text AS cefr,
        created_at
      FROM public.test_results
      WHERE skill_scores IS NOT NULL
        AND jsonb_typeof(skill_scores) = 'object'
        AND (skill_scores->>'skill') IS NOT NULL
        AND (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
      UNION ALL
      SELECT user_id, 'writing'::text, scale50::numeric, cefr, created_at
      FROM public.writing_skill_results
      WHERE (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
      UNION ALL
      SELECT user_id, 'speaking'::text, scale50::numeric, cefr, created_at
      FROM public.speaking_skill_results
      WHERE (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
    ),
    valid AS (
      SELECT * FROM attempts WHERE skill IS NOT NULL AND scaled IS NOT NULL
    ),
    banded AS (
      SELECT v.*,
        CASE
          WHEN cefr IS NOT NULL AND btrim(cefr) <> '' THEN
            CASE
              WHEN upper(cefr) LIKE 'C%' THEN 'C'
              WHEN upper(cefr) IN ('A0','A1','A2','B1','B2') THEN upper(cefr)
              ELSE 'A0'
            END
          ELSE
            CASE skill
              WHEN 'reading' THEN
                CASE WHEN scaled >= 46 THEN 'C' WHEN scaled >= 38 THEN 'B2' WHEN scaled >= 26 THEN 'B1' WHEN scaled >= 16 THEN 'A2' WHEN scaled >= 8 THEN 'A1' ELSE 'A0' END
              WHEN 'listening' THEN
                CASE WHEN scaled >= 42 THEN 'C' WHEN scaled >= 34 THEN 'B2' WHEN scaled >= 24 THEN 'B1' WHEN scaled >= 16 THEN 'A2' WHEN scaled >= 8 THEN 'A1' ELSE 'A0' END
              WHEN 'writing' THEN
                CASE WHEN scaled >= 48 THEN 'C' WHEN scaled >= 40 THEN 'B2' WHEN scaled >= 26 THEN 'B1' WHEN scaled >= 18 THEN 'A2' WHEN scaled >= 6 THEN 'A1' ELSE 'A0' END
              WHEN 'speaking' THEN
                CASE WHEN scaled >= 48 THEN 'C' WHEN scaled >= 41 THEN 'B2' WHEN scaled >= 26 THEN 'B1' WHEN scaled >= 16 THEN 'A2' WHEN scaled >= 4 THEN 'A1' ELSE 'A0' END
              ELSE 'A0'
            END
        END AS band
      FROM valid v
    ),
    latest_per_user AS (
      SELECT DISTINCT ON (user_id, skill) user_id, skill, band, scaled, created_at
      FROM banded
      WHERE skill IN ('reading','listening','writing','speaking')
      ORDER BY user_id, skill, created_at DESC
    ),
    avg_by_skill AS (
      SELECT skill,
             ROUND(AVG(scaled)::numeric, 1)::float AS avg_scaled,
             count(*)::int AS n
      FROM banded
      GROUP BY skill
    ),
    band_dist AS (
      SELECT skill, band, count(*)::int AS n
      FROM latest_per_user
      GROUP BY skill, band
    ),
    first_last AS (
      SELECT user_id, skill,
             (array_agg(band ORDER BY created_at ASC))[1] AS first_band,
             (array_agg(band ORDER BY created_at DESC))[1] AS last_band,
             count(*)::int AS attempts
      FROM banded
      WHERE skill IN ('reading','listening','writing','speaking')
      GROUP BY user_id, skill
    ),
    band_rank(band, rk) AS (
      VALUES ('A0',0),('A1',1),('A2',2),('B1',3),('B2',4),('C',5)
    ),
    improved AS (
      SELECT
        count(DISTINCT user_id) FILTER (WHERE attempts >= 2) AS total,
        count(DISTINCT user_id) FILTER (
          WHERE attempts >= 2
            AND COALESCE((SELECT rk FROM band_rank WHERE band = fl.last_band), 0)
              > COALESCE((SELECT rk FROM band_rank WHERE band = fl.first_band), 0)
        ) AS improved
      FROM first_last fl
    ),
    tl AS (
      SELECT to_char((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
             ROUND(AVG(scaled)::numeric, 1)::float AS avg
      FROM banded
      GROUP BY 1
      ORDER BY 1
    )
    SELECT jsonb_build_object(
      'avg_by_skill', COALESCE((SELECT jsonb_agg(row_to_json(avg_by_skill)) FROM avg_by_skill), '[]'::jsonb),
      'band_dist',    COALESCE((SELECT jsonb_agg(row_to_json(band_dist))    FROM band_dist),    '[]'::jsonb),
      'improvement',  (SELECT row_to_json(improved) FROM improved),
      'timeline',     COALESCE((SELECT jsonb_agg(row_to_json(tl)) FROM tl), '[]'::jsonb),
      'total_attempts', (SELECT count(*)::int FROM banded)
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_outcomes(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_outcomes(timestamptz, timestamptz) TO authenticated;

-- 7) admin_content_quality
CREATE OR REPLACE FUNCTION public.admin_content_quality(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN jsonb_build_object(
    'top_reported', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.count) DESC)
      FROM (
        SELECT qr.exam_question_id::text AS qid,
               count(*)::int AS count,
               eq.question_text AS text,
               eq.exam_set_id::text AS set_id,
               es.title AS set_title
        FROM public.question_reports qr
        LEFT JOIN public.exam_questions eq ON eq.id = qr.exam_question_id
        LEFT JOIN public.exam_sets es ON es.id = eq.exam_set_id
        WHERE qr.exam_question_id IS NOT NULL
          AND (p_from IS NULL OR qr.created_at >= p_from)
          AND (p_to IS NULL OR qr.created_at <= p_to)
        GROUP BY qr.exam_question_id, eq.question_text, eq.exam_set_id, es.title
        ORDER BY count(*) DESC
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'suspect_wrong', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.rate) DESC)
      FROM (
        SELECT r.exam_question_id::text AS qid,
               count(*)::int AS total,
               count(*) FILTER (WHERE r.is_correct = false)::int AS wrong,
               ROUND((count(*) FILTER (WHERE r.is_correct = false))::numeric / count(*), 4)::float AS rate,
               eq.question_text AS text,
               eq.exam_set_id::text AS set_id,
               es.title AS set_title
        FROM public.exam_question_results r
        LEFT JOIN public.exam_questions eq ON eq.id = r.exam_question_id
        LEFT JOIN public.exam_sets es ON es.id = eq.exam_set_id
        WHERE r.exam_question_id IS NOT NULL
          AND r.is_correct IS NOT NULL
          AND (p_from IS NULL OR r.created_at >= p_from)
          AND (p_to IS NULL OR r.created_at <= p_to)
        GROUP BY r.exam_question_id, eq.question_text, eq.exam_set_id, es.title
        HAVING count(*) >= 5
           AND (count(*) FILTER (WHERE r.is_correct = false))::numeric / count(*) >= 0.7
        ORDER BY rate DESC
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'hot_sets', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.count) DESC)
      FROM (
        SELECT tr.exam_set_id::text AS set_id,
               count(*)::int AS count,
               es.title AS title
        FROM public.test_results tr
        LEFT JOIN public.exam_sets es ON es.id = tr.exam_set_id
        WHERE tr.exam_set_id IS NOT NULL
          AND (p_from IS NULL OR tr.created_at >= p_from)
          AND (p_to IS NULL OR tr.created_at <= p_to)
        GROUP BY tr.exam_set_id, es.title
        ORDER BY count DESC
        LIMIT 50
      ) x
    ), '[]'::jsonb),
    'cold_sets', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.count) ASC)
      FROM (
        SELECT tr.exam_set_id::text AS set_id,
               count(*)::int AS count,
               es.title AS title
        FROM public.test_results tr
        LEFT JOIN public.exam_sets es ON es.id = tr.exam_set_id
        WHERE tr.exam_set_id IS NOT NULL
          AND (p_from IS NULL OR tr.created_at >= p_from)
          AND (p_to IS NULL OR tr.created_at <= p_to)
        GROUP BY tr.exam_set_id, es.title
        HAVING count(*) > 0
        ORDER BY count ASC
        LIMIT 50
      ) x
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_content_quality(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_content_quality(timestamptz, timestamptz) TO authenticated;
