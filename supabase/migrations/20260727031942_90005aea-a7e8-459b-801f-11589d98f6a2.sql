CREATE OR REPLACE FUNCTION public.homepage_update_feed(p_limit integer DEFAULT 200)
RETURNS TABLE (
  kind text,
  day date,
  skill text,
  part text,
  cnt integer,
  key_id uuid,
  key_title text,
  item_count integer,
  high_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  (
    SELECT 'exam'::text AS kind,
           (es.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
           es.skill::text,
           es.part::text,
           COUNT(*)::int AS cnt,
           NULL::uuid, NULL::text, NULL::int, NULL::int
    FROM public.exam_sets es
    WHERE es.is_published = true
    GROUP BY 1,2,3,4
  )
  UNION ALL
  (
    SELECT 'key'::text,
           pk.date,
           NULL::text,
           NULL::text,
           NULL::int,
           pk.id,
           pk.title,
           COALESCE(i.total, 0)::int,
           COALESCE(i.high, 0)::int
    FROM public.prediction_keys pk
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE pi.priority = 'high')::int AS high
      FROM public.prediction_items pi
      WHERE pi.key_id = pk.id
    ) i ON true
    WHERE pk.is_published = true
  )
  ORDER BY day DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.homepage_update_feed(integer) TO anon, authenticated, service_role;