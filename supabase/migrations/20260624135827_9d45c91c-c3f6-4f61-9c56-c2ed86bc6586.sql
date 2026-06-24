
CREATE TABLE public.feature_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_key text NOT NULL,
  scope text NULL,
  ref_id text NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feature_usage_user_key_time_idx ON public.feature_usage (user_id, feature_key, used_at);
CREATE UNIQUE INDEX feature_usage_user_key_ref_uidx ON public.feature_usage (user_id, feature_key, ref_id) WHERE ref_id IS NOT NULL;

GRANT SELECT, INSERT ON public.feature_usage TO authenticated;
GRANT ALL ON public.feature_usage TO service_role;

ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_usage_select_own" ON public.feature_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "feature_usage_insert_own" ON public.feature_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- check_feature_access
CREATE OR REPLACE FUNCTION public.check_feature_access(p_key text, p_scope text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_flag public.feature_flags%ROWTYPE;
  v_is_pro boolean := false;
  v_used integer := 0;
  v_remaining integer;
  v_window_start timestamptz;
BEGIN
  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_flag', 'is_pro', false, 'enabled', true);
  END IF;

  IF v_flag.enabled = false THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'disabled', 'is_pro', false,
      'required_tier', v_flag.required_tier, 'free_quota', v_flag.free_quota,
      'used', 0, 'remaining', 0, 'enabled', false
    );
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'unauthenticated', 'is_pro', false,
      'required_tier', v_flag.required_tier, 'free_quota', v_flag.free_quota,
      'used', 0, 'remaining', v_flag.free_quota, 'enabled', true
    );
  END IF;

  v_is_pro := public.is_pro(v_uid);

  IF v_flag.required_tier = 'free' THEN
    RETURN jsonb_build_object(
      'allowed', true, 'reason', 'free_tier', 'is_pro', v_is_pro,
      'required_tier', 'free', 'free_quota', v_flag.free_quota,
      'used', 0, 'remaining', NULL, 'enabled', true
    );
  END IF;

  IF v_is_pro THEN
    RETURN jsonb_build_object(
      'allowed', true, 'reason', 'pro', 'is_pro', true,
      'required_tier', v_flag.required_tier, 'free_quota', v_flag.free_quota,
      'used', 0, 'remaining', NULL, 'enabled', true
    );
  END IF;

  -- Compute window
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

  v_remaining := GREATEST(0, COALESCE(v_flag.free_quota, 0) - v_used);

  RETURN jsonb_build_object(
    'allowed', v_used < COALESCE(v_flag.free_quota, 0),
    'reason', CASE WHEN v_used < COALESCE(v_flag.free_quota, 0) THEN 'within_quota' ELSE 'quota_exceeded' END,
    'is_pro', false,
    'required_tier', v_flag.required_tier,
    'free_quota', v_flag.free_quota,
    'used', v_used,
    'remaining', v_remaining,
    'enabled', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_feature_access(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_feature_access(text, text) TO authenticated, service_role;

-- log_feature_usage
CREATE OR REPLACE FUNCTION public.log_feature_usage(p_key text, p_ref text DEFAULT NULL, p_scope text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF p_ref IS NULL THEN
    INSERT INTO public.feature_usage (user_id, feature_key, scope, ref_id)
    VALUES (v_uid, p_key, p_scope, NULL);
  ELSE
    INSERT INTO public.feature_usage (user_id, feature_key, scope, ref_id)
    VALUES (v_uid, p_key, p_scope, p_ref)
    ON CONFLICT (user_id, feature_key, ref_id) WHERE ref_id IS NOT NULL DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_feature_usage(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_feature_usage(text, text, text) TO authenticated, service_role;
