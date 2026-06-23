-- 1) Daily AI quota counter
CREATE TABLE public.ai_daily_quota (
  user_id uuid NOT NULL,
  action text NOT NULL,
  day date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action, day)
);

GRANT SELECT ON public.ai_daily_quota TO authenticated;
GRANT ALL ON public.ai_daily_quota TO service_role;

ALTER TABLE public.ai_daily_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quota"
  ON public.ai_daily_quota
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Atomic increment-and-check. Returns { ok, used, limit }.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _user_id uuid,
  _action text,
  _limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := ((now() AT TIME ZONE 'UTC')::date);
  _used integer;
BEGIN
  INSERT INTO public.ai_daily_quota (user_id, action, day, used)
  VALUES (_user_id, _action, _day, 1)
  ON CONFLICT (user_id, action, day) DO UPDATE
    SET used = public.ai_daily_quota.used + 1,
        updated_at = now()
  RETURNING used INTO _used;

  IF _used > _limit THEN
    -- roll back this increment so the counter stays at the limit
    UPDATE public.ai_daily_quota
       SET used = used - 1
     WHERE user_id = _user_id AND action = _action AND day = _day;
    RETURN jsonb_build_object('ok', false, 'used', _used - 1, 'limit', _limit);
  END IF;

  RETURN jsonb_build_object('ok', true, 'used', _used, 'limit', _limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer) TO service_role;

-- 2) Grading cache: skip re-grading identical submissions
CREATE TABLE public.grading_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX grading_cache_user_hash_idx
  ON public.grading_cache (user_id, request_hash);

GRANT SELECT ON public.grading_cache TO authenticated;
GRANT ALL ON public.grading_cache TO service_role;

ALTER TABLE public.grading_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grading cache"
  ON public.grading_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);