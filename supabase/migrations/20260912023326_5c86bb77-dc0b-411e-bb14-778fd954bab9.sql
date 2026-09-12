CREATE OR REPLACE FUNCTION public.try_jsonb(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN RETURN NULL; END IF;
  RETURN p_text::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.try_jsonb(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_jsonb(text) TO authenticated, service_role;

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
  ), secs AS (
    SELECT w.*,
      CASE WHEN p_skill = 'reading' AND regexp_replace(p_part, '\D', '', 'g') = '2' THEN (
        SELECT COALESCE(jsonb_agg(t.i ORDER BY t.i), '[]'::jsonb)
        FROM (
          SELECT gs.i,
            (
              SELECT count(*)
              FROM jsonb_array_elements(COALESCE(qd.extra_data->'sentences', '[]'::jsonb)) s
              WHERE (s->>'correctPosition')::int BETWEEN gs.i * 5 + 1 AND gs.i * 5 + 5
                AND NOT (
                  gs.i = 0
                  AND (s->>'correctPosition')::int = 1
                  AND COALESCE(jsonb_array_length(qd.extra_data->'givenSentences'), 0) = 0
                )
                AND COALESCE(
                      ua.answers -> gs.i ->> (((s->>'correctPosition')::int - gs.i * 5)::text),
                      ''
                    ) IS DISTINCT FROM COALESCE(s->>'text', '')
            ) > 0 AS is_wrong
          FROM generate_series(0, 1) gs(i)
        ) t
        WHERE t.is_wrong
      ) ELSE NULL END AS wrong_sections
    FROM wrong w
    LEFT JOIN LATERAL (
      SELECT q.extra_data
      FROM public.exam_questions q
      WHERE q.exam_set_id = w.exam_set_id
      ORDER BY q.created_at
      LIMIT 1
    ) qd ON true
    LEFT JOIN LATERAL (
      SELECT public.try_jsonb(w.review_snapshot->'raw'->'perQuestion'->0->>'user_answer') -> 'answers' AS answers
    ) ua ON true
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'exam_set_id', w.exam_set_id,
      'title', w.title,
      'score', w.score,
      'total', w.total,
      'wrong_section_indexes', w.wrong_sections,
      'wrong_question_ids', CASE
        WHEN jsonb_array_length(w.wrong_ids) > 0 THEN w.wrong_ids
        ELSE (SELECT COALESCE(jsonb_agg(q.id), '[]'::jsonb) FROM public.exam_questions q WHERE q.exam_set_id = w.exam_set_id)
      END
    )
    ORDER BY COALESCE(NULLIF((regexp_match(COALESCE(w.title, ''), '\d+'))[1], '')::int, 999999), w.title
  ), '[]'::jsonb)
  FROM secs w;
$$;

REVOKE ALL ON FUNCTION public.get_wrong_questions(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wrong_questions(text, text) TO authenticated;