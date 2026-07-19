
-- 1) Grading tables: remove client UPDATE ability. Client can still INSERT
--    initial rows; the internal worker uses service_role and bypasses RLS
--    for corrections/re-grades.
DROP POLICY IF EXISTS "Users update own speaking gradings" ON public.speaking_question_gradings;
DROP POLICY IF EXISTS "Users update own writing gradings" ON public.writing_question_gradings;

REVOKE UPDATE ON public.speaking_question_gradings FROM authenticated;
REVOKE UPDATE ON public.writing_question_gradings FROM authenticated;

-- 2) test_results: constrain client UPDATE to review_snapshot only via
--    column-level GRANT. RLS policy still scopes to owner.
DROP POLICY IF EXISTS "Users can update own results" ON public.test_results;
CREATE POLICY "Users can update own results (snapshot only)"
  ON public.test_results
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE ON public.test_results FROM authenticated;
GRANT UPDATE (review_snapshot) ON public.test_results TO authenticated;

-- 3) Controlled server-side finalize for score/level/total/correct_answers.
--    Ownership-checked SECURITY DEFINER RPC so writes are auditable and
--    can be tightened further (e.g. recompute from *_question_gradings).
CREATE OR REPLACE FUNCTION public.finalize_skill_test_result(
  p_test_result_id uuid,
  p_score numeric DEFAULT NULL,
  p_total numeric DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_correct_answers numeric DEFAULT NULL,
  p_review_snapshot jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.test_results WHERE id = p_test_result_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_owner <> auth.uid() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.test_results
     SET score           = COALESCE(p_score,           score),
         total           = COALESCE(p_total,           total),
         level           = COALESCE(p_level,           level),
         correct_answers = COALESCE(p_correct_answers, correct_answers),
         review_snapshot = COALESCE(p_review_snapshot, review_snapshot)
   WHERE id = p_test_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_skill_test_result(uuid, numeric, numeric, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_skill_test_result(uuid, numeric, numeric, text, numeric, jsonb) TO authenticated, service_role;
