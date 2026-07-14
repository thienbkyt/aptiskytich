CREATE OR REPLACE FUNCTION public.admin_activity_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_today_start timestamptz := (date_trunc('day', v_now AT TIME ZONE 'Asia/Ho_Chi_Minh')) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_span interval;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
  v_total_users int;
  v_total_users_at_end int;
  v_new_users int;
  v_new_users_prev int := 0;
  v_dau int;
  v_wau int;
  v_mau int;
  v_visits_today int;
  v_visits_period int;
  v_consistent int;
  v_revenue_period bigint;
  v_revenue_all bigint;
  v_paying int;
  v_pro int;
  v_premium int;
  v_orders int;
  v_expiring int;
  v_period_seconds numeric;
  v_days int;
  v_active_users_period int;
  v_consistent_users_period int;
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

  SELECT count(*) INTO v_total_users_at_end
    FROM public.profiles
   WHERE (p_to IS NULL OR created_at <= p_to);

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

  SELECT count(*) INTO v_visits_period
    FROM public.site_visits
   WHERE (p_from IS NULL OR created_at >= p_from)
     AND (p_to IS NULL OR created_at <= p_to);

  SELECT count(*) INTO v_consistent
    FROM public.learning_streaks
   WHERE COALESCE(current_streak, 0) >= 7;

  -- Threshold for "consistent in period": at most 3, at least 1, or period length if shorter
  v_period_seconds := EXTRACT(epoch FROM (COALESCE(p_to, v_now) - COALESCE(p_from, v_now - interval '30 days')));
  v_days := GREATEST(1, LEAST(3, CEIL(v_period_seconds / 86400)::int));

  SELECT count(DISTINCT user_id) INTO v_active_users_period
    FROM public.test_results
   WHERE (p_from IS NULL OR created_at >= p_from)
     AND (p_to IS NULL OR created_at <= p_to);

  SELECT count(*) INTO v_consistent_users_period
  FROM (
    SELECT user_id
      FROM public.test_results
     WHERE (p_from IS NULL OR created_at >= p_from)
       AND (p_to IS NULL OR created_at <= p_to)
     GROUP BY user_id
    HAVING count(DISTINCT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) >= v_days
  ) t;

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
    'total_users_at_end', v_total_users_at_end,
    'new_users', v_new_users,
    'new_users_prev', v_new_users_prev,
    'dau', v_dau, 'wau', v_wau, 'mau', v_mau,
    'visits_today', v_visits_today,
    'visits_period', v_visits_period,
    'consistent_users', v_consistent,
    'active_users_period', v_active_users_period,
    'consistent_users_period', v_consistent_users_period,
    'consistent_threshold_days', v_days,
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
$function$;