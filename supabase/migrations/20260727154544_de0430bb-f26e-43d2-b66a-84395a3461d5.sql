CREATE OR REPLACE FUNCTION public.admin_user_test_stats()
RETURNS TABLE(user_id uuid, total_attempts integer, latest_level text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.user_id,
         COUNT(*)::int AS total_attempts,
         (ARRAY_AGG(t.level ORDER BY t.created_at DESC))[1] AS latest_level
  FROM public.test_results t
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY t.user_id
$$;

REVOKE ALL ON FUNCTION public.admin_user_test_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_test_stats() TO authenticated, service_role;