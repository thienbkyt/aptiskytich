CREATE OR REPLACE FUNCTION public.get_full_tests(p_category text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(elem ORDER BY ft_created_at), '[]'::jsonb)
  FROM (
    SELECT
      ft.created_at AS ft_created_at,
      jsonb_build_object(
        'fullTestId', ft.id,
        'title', ft.title,
        'category', ft.category,
        'examSetIds', COALESCE(array_agg(m.exam_set_id) FILTER (WHERE m.exam_set_id IS NOT NULL), '{}'::uuid[]),
        'skills', COALESCE((
          SELECT array_agg(DISTINCT es.skill)
          FROM public.full_test_members fm
          JOIN public.exam_sets es ON es.id = fm.exam_set_id
          WHERE fm.full_test_id = ft.id AND es.is_published = true
        ), '{}'::text[]),
        'access_tier', COALESCE((
          SELECT CASE
            WHEN bool_or(COALESCE(es.access_tier, 'pro') = 'premium') THEN 'premium'
            WHEN bool_or(COALESCE(es.access_tier, 'pro') = 'pro') THEN 'pro'
            ELSE 'free'
          END
          FROM public.full_test_members fm
          JOIN public.exam_sets es ON es.id = fm.exam_set_id
          WHERE fm.full_test_id = ft.id AND es.is_published = true
        ), 'pro'),
        'isNew', COALESCE((
          SELECT bool_or(es.new_until IS NOT NULL AND es.new_until > now())
          FROM public.full_test_members fm
          JOIN public.exam_sets es ON es.id = fm.exam_set_id
          WHERE fm.full_test_id = ft.id AND es.is_published = true
        ), false)
      ) AS elem
    FROM public.full_tests ft
    LEFT JOIN public.full_test_members m ON m.full_test_id = ft.id
    WHERE ft.is_published = true AND ft.category = p_category
    GROUP BY ft.id, ft.title, ft.category, ft.created_at
    ORDER BY ft.created_at
  ) t
$$;

GRANT EXECUTE ON FUNCTION public.get_full_tests(text) TO anon, authenticated;