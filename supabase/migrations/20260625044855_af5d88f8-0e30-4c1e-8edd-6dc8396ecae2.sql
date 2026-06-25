
-- 1) user_subscriptions: plan -> tier
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;
ALTER TABLE public.user_subscriptions RENAME COLUMN plan TO tier;
ALTER TABLE public.user_subscriptions ALTER COLUMN tier SET DEFAULT 'free';
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_tier_check
  CHECK (tier IN ('free','pro','premium'));

-- 2) feature_flags: add pro_quota; relax required_tier check to include premium
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS pro_quota integer;
ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_required_tier_check;
ALTER TABLE public.feature_flags
  ADD CONSTRAINT feature_flags_required_tier_check
  CHECK (required_tier IN ('free','pro','premium'));

UPDATE public.feature_flags SET free_quota=3, pro_quota=10, quota_period='month' WHERE key='ai_grading_writing';
UPDATE public.feature_flags SET free_quota=3, pro_quota=10, quota_period='month' WHERE key='ai_grading_speaking';
UPDATE public.feature_flags SET free_quota=5, pro_quota=20, quota_period='day' WHERE key='ai_coach';

-- 3) exam_sets.access_tier: allow 3 values
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid='public.exam_sets'::regclass AND contype='c'
     AND pg_get_constraintdef(oid) ILIKE '%access_tier%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.exam_sets DROP CONSTRAINT %I', c); END IF;
END$$;
ALTER TABLE public.exam_sets
  ADD CONSTRAINT exam_sets_access_tier_check
  CHECK (access_tier IN ('free','pro','premium'));

-- 4) pricing_plans: add tier
ALTER TABLE public.pricing_plans ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE public.pricing_plans DROP CONSTRAINT IF EXISTS pricing_plans_tier_check;
ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_tier_check
  CHECK (tier IS NULL OR tier IN ('pro','premium'));
UPDATE public.pricing_plans SET tier='pro' WHERE key IN ('day','week','month');
UPDATE public.pricing_plans SET tier='premium' WHERE key='lifetime';

-- 5) Functions
CREATE OR REPLACE FUNCTION public.tier_rank(t text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE t WHEN 'premium' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.user_tier(p_uid uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tier text;
BEGIN
  IF public.promo_active() THEN RETURN 'premium'; END IF;
  IF p_uid IS NULL THEN RETURN 'free'; END IF;
  SELECT tier INTO v_tier
    FROM public.user_subscriptions
   WHERE user_id = p_uid
     AND tier IN ('pro','premium')
     AND (pro_until IS NULL OR pro_until > now())
   LIMIT 1;
  RETURN COALESCE(v_tier, 'free');
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_tier()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_tier(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_pro(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_tier(p_uid) IN ('pro','premium');
$$;

CREATE OR REPLACE FUNCTION public.is_premium(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_tier(p_uid) = 'premium';
$$;

-- 6) check_feature_access — 3-tier aware
CREATE OR REPLACE FUNCTION public.check_feature_access(p_key text, p_scope text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    v_cap := v_flag.pro_quota;  -- NULL → unlimited
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
    v_window_start := date_trunc('day', now());
  ELSIF v_flag.quota_period = 'month' THEN
    v_window_start := date_trunc('month', now());
  ELSE
    v_window_start := 'epoch'::timestamptz;
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
$$;
