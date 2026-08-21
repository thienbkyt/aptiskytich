-- Remove authenticated client INSERT path on test_results.
-- Writes must go through the insert_test_result SECURITY DEFINER RPC or service_role.
DROP POLICY IF EXISTS "Users can insert own results" ON public.test_results;

REVOKE INSERT ON public.test_results FROM authenticated;
REVOKE UPDATE ON public.test_results FROM authenticated;
GRANT UPDATE (review_snapshot, grade_payload) ON public.test_results TO authenticated;
GRANT ALL ON public.test_results TO service_role;

-- Controlled server-side insert for test_results.
CREATE OR REPLACE FUNCTION public.insert_test_result(
  p_user_id uuid,
  p_exam_set_id uuid DEFAULT NULL,
  p_score integer DEFAULT 0,
  p_total integer DEFAULT 1,
  p_level text DEFAULT 'A1',
  p_correct_answers integer DEFAULT 0,
  p_time_spent integer DEFAULT NULL,
  p_skill_scores jsonb DEFAULT NULL,
  p_full_test_session_id uuid DEFAULT NULL,
  p_full_test_id uuid DEFAULT NULL,
  p_review_snapshot jsonb DEFAULT NULL,
  p_grade_payload jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.test_results (
    user_id,
    exam_set_id,
    score,
    total,
    level,
    correct_answers,
    time_spent,
    skill_scores,
    full_test_session_id,
    full_test_id,
    review_snapshot,
    grade_payload
  ) VALUES (
    p_user_id,
    p_exam_set_id,
    p_score,
    p_total,
    p_level,
    p_correct_answers,
    p_time_spent,
    p_skill_scores,
    p_full_test_session_id,
    p_full_test_id,
    p_review_snapshot,
    p_grade_payload
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_test_result FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_test_result TO authenticated, service_role;