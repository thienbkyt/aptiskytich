
CREATE OR REPLACE FUNCTION public.exam_priority_counts(p_window int DEFAULT 30)
RETURNS TABLE(exam_set_id uuid, key_count int, window_size int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent_keys AS (
    SELECT id
    FROM public.prediction_keys
    WHERE is_published = true
    ORDER BY date DESC
    LIMIT GREATEST(1, LEAST(p_window, 365))
  ),
  win AS (SELECT count(*)::int AS n FROM recent_keys)
  SELECT pi.exam_set_id,
         count(DISTINCT pi.key_id)::int AS key_count,
         (SELECT n FROM win) AS window_size
  FROM public.prediction_items pi
  JOIN recent_keys rk ON rk.id = pi.key_id
  WHERE pi.exam_set_id IS NOT NULL
  GROUP BY pi.exam_set_id;
$$;

GRANT EXECUTE ON FUNCTION public.exam_priority_counts(int) TO anon, authenticated, service_role;
