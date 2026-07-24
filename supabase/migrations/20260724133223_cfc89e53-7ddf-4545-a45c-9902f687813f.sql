
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON public.profiles (last_active_at DESC);

CREATE OR REPLACE FUNCTION public.touch_last_active()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.profiles
     SET last_active_at = now()
   WHERE user_id = uid
     AND (last_active_at IS NULL OR last_active_at < now() - interval '30 seconds');
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_online_users(p_window_seconds int DEFAULT 300)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT COUNT(*) INTO n
    FROM public.profiles
   WHERE last_active_at >= now() - make_interval(secs => p_window_seconds);
  RETURN COALESCE(n, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_online_users(int) TO authenticated;
