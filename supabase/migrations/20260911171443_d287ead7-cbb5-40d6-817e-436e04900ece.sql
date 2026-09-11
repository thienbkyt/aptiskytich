CREATE OR REPLACE FUNCTION public.get_wrong_questions(p_skill text, p_part text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (r.exam_set_id)
      r.exam_set_id, s.title, r.score, r.total, r.review_snapshot
    FROM public.test_results r
    JOIN public.exam_sets s ON s.id = r.exam_set_id
    WHERE r.user_id = auth.uid()
      AND s.skill = p_skill
      AND s.part ILIKE 'part ' || regexp_replace(p_part, '\D', '', 'g') || '%'
      AND s.is_published
      AND r.full_test_session_id IS NULL
      AND r.full_test_id IS NULL
      AND COALESCE(r.skill_scores->>'mode', '') NOT LIKE 'marathon%'
    ORDER BY r.exam_set_id, r.created_at DESC
  ), wrong AS (
    SELECT l.*, (
      SELECT COALESCE(jsonb_agg(pq->>'exam_question_id'), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(l.review_snapshot->'raw'->'perQuestion', '[]'::jsonb)) pq
      WHERE COALESCE((pq->>'is_correct')::boolean, false) = false
        AND pq->>'exam_question_id' IS NOT NULL
    ) AS wrong_ids
    FROM latest l
    WHERE l.total > 0 AND l.score < l.total
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'exam_set_id', w.exam_set_id,
      'title', w.title,
      'score', w.score,
      'total', w.total,
      'wrong_question_ids', CASE
        WHEN jsonb_array_length(w.wrong_ids) > 0 THEN w.wrong_ids
        ELSE (SELECT COALESCE(jsonb_agg(q.id), '[]'::jsonb) FROM public.exam_questions q WHERE q.exam_set_id = w.exam_set_id)
      END
    )
    ORDER BY COALESCE(NULLIF((regexp_match(COALESCE(w.title, ''), '\d+'))[1], '')::int, 999999), w.title
  ), '[]'::jsonb)
  FROM wrong w;
$$;

REVOKE ALL ON FUNCTION public.get_wrong_questions(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wrong_questions(text, text) TO authenticated;