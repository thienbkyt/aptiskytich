CREATE OR REPLACE FUNCTION public.check_feature_access(p_key text, p_scope text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_flag public.feature_flags%ROWTYPE;
  v_tier text := 'free';
  v_used integer := 0;
  v_cap integer;
  v_window_start timestamptz;
BEGIN
  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'reason','no_flag','is_pro', false,'tier','free','enabled', true);
  END IF;

  v_tier := public.user_tier(v_uid);

  IF v_flag.enabled = false THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason','disabled','is_pro', v_tier <> 'free','tier', v_tier,
      'required_tier', v_flag.required_tier,'free_quota', v_flag.free_quota,'pro_quota', v_flag.pro_quota,
      'used', 0,'remaining', 0,'enabled', false
    );
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,'reason','unauthenticated','is_pro', false,'tier','free',
      'required_tier', v_flag.required_tier,'free_quota', v_flag.free_quota,'pro_quota', v_flag.pro_quota,
      'used', 0,'remaining', v_flag.free_quota,'enabled', true
    );
  END IF;

  -- Premium: unlimited
  IF v_tier = 'premium' THEN
    RETURN jsonb_build_object(
      'allowed', true,'reason','premium','is_pro', true,'tier','premium',
      'required_tier', v_flag.required_tier,'free_quota', v_flag.free_quota,'pro_quota', v_flag.pro_quota,
      'used', 0,'remaining', NULL,'enabled', true
    );
  END IF;

  -- free_tier flag with no quota → always allowed
  IF v_flag.required_tier = 'free' AND v_flag.free_quota IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,'reason','free_tier','is_pro', v_tier <> 'free','tier', v_tier,
      'required_tier','free','free_quota', v_flag.free_quota,'pro_quota', v_flag.pro_quota,
      'used', 0,'remaining', NULL,'enabled', true
    );
  END IF;

  -- Determine cap based on tier
  IF v_tier = 'pro' THEN
    IF p_key IN ('ai_grading_writing','ai_grading_speaking') THEN
      v_cap := COALESCE(
        (SELECT ai_daily_cap FROM public.user_subscriptions WHERE user_id = v_uid),
        v_flag.pro_quota
      );
    ELSE
      v_cap := v_flag.pro_quota;  -- NULL → unlimited
    END IF;
  ELSE
    v_cap := v_flag.free_quota;
  END IF;

  -- Pro with no cap → unlimited
  IF v_tier = 'pro' AND v_cap IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,'reason','pro_unlimited','is_pro', true,'tier','pro',
      'required_tier', v_flag.required_tier,'free_quota', v_flag.free_quota,'pro_quota', v_flag.pro_quota,
      'used', 0,'remaining', NULL,'enabled', true
    );
  END IF;

  -- Compute usage window
  IF v_flag.quota_period = 'day' THEN
    v_window_start := date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh';
  ELSIF v_flag.quota_period = 'month' THEN
    v_window_start := date_trunc('month', now());
  ELSE
    v_window_start := 'epoch'::timestamptz;
  END IF;

  -- Free tier: AI grading lifetime count, starting from the 01/08/2026 pricing launch
  IF v_tier = 'free' AND p_key IN ('ai_grading_writing','ai_grading_speaking') THEN
    v_window_start := '2026-07-31 17:00:00+00'::timestamptz;
  END IF;

  SELECT COUNT(DISTINCT COALESCE(ref_id, id::text))
    INTO v_used
    FROM public.feature_usage
   WHERE user_id = v_uid
     AND feature_key = p_key
     AND (p_scope IS NULL OR scope = p_scope)
     AND used_at >= v_window_start;

  RETURN jsonb_build_object(
    'allowed', v_used < COALESCE(v_cap, 0),
    'reason', CASE WHEN v_used < COALESCE(v_cap, 0) THEN 'within_quota' ELSE 'quota_exceeded' END,
    'is_pro', v_tier <> 'free','tier', v_tier,
    'required_tier', v_flag.required_tier,'free_quota', v_flag.free_quota,'pro_quota', v_flag.pro_quota,
    'used', v_used,
    'remaining', GREATEST(0, COALESCE(v_cap, 0) - v_used),
    'enabled', true
  );
END;
$function$;