CREATE OR REPLACE FUNCTION public.homepage_update_feed_items(p_limit integer DEFAULT 200)
RETURNS TABLE (
  kind text,
  day date,
  skill text,
  part text,
  set_id uuid,
  set_title text,
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
    SELECT 'exam'::text AS kind, r.day, r.skill, r.part, r.set_id, r.set_title,
           NULL::uuid, NULL::text, NULL::int, NULL::int
    FROM (
      SELECT (es.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
             es.skill::text AS skill,
             es.part::text AS part,
             es.id AS set_id,
             es.title AS set_title,
             ROW_NUMBER() OVER (
               PARTITION BY (es.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
               ORDER BY es.created_at DESC
             ) AS rn
      FROM public.exam_sets es
      WHERE es.is_published = true
    ) r
    WHERE r.rn <= 3
  )
  UNION ALL
  (
    SELECT 'key'::text, pk.date, NULL::text, NULL::text, NULL::uuid, NULL::text,
           pk.id, pk.title,
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

GRANT EXECUTE ON FUNCTION public.homepage_update_feed_items(integer) TO anon, authenticated, service_role;