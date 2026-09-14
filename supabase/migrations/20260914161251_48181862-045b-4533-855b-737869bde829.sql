CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action, window_start)
);

GRANT ALL ON public.ai_rate_limits TO service_role;

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate limits"
ON public.ai_rate_limits FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  _user_id uuid,
  _action text,
  _window_seconds integer,
  _limit integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _win timestamptz;
  _used integer;
BEGIN
  _win := to_timestamp(floor(extract(epoch from now()) / GREATEST(_window_seconds, 1)) * GREATEST(_window_seconds, 1));

  INSERT INTO public.ai_rate_limits (user_id, action, window_start, used, updated_at)
  VALUES (_user_id, _action, _win, 1, now())
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET used = public.ai_rate_limits.used + 1, updated_at = now()
  RETURNING used INTO _used;

  DELETE FROM public.ai_rate_limits
  WHERE user_id = _user_id AND action = _action AND window_start < _win - make_interval(secs => _window_seconds * 5);

  RETURN jsonb_build_object('ok', _used <= _limit, 'used', _used, 'limit', _limit);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_ai_rate_limit(uuid, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(uuid, text, integer, integer) TO service_role;