-- Drop the overly permissive UPDATE policy that allowed any authenticated user
-- to modify every column on their own test_results row.
DROP POLICY IF EXISTS "Users can update own results (snapshot only)" ON public.test_results;

-- SECURITY DEFINER helper: write grade_payload for a specific attempt.
-- Only the row owner (or an admin) may call this.
CREATE OR REPLACE FUNCTION public.update_test_result_grade_payload(
  p_test_result_id uuid,
  p_grade_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.test_results
    WHERE id = p_test_result_id
      AND (
        user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this test result' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.test_results
  SET grade_payload = p_grade_payload
  WHERE id = p_test_result_id;
END;
$$;

-- SECURITY DEFINER helper: write review_snapshot for a specific attempt.
-- Only the row owner (or an admin) may call this.
CREATE OR REPLACE FUNCTION public.merge_test_result_review_snapshot(
  p_test_result_id uuid,
  p_review_snapshot jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.test_results
    WHERE id = p_test_result_id
      AND (
        user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this test result' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.test_results
  SET review_snapshot = p_review_snapshot
  WHERE id = p_test_result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_test_result_grade_payload(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_test_result_review_snapshot(uuid, jsonb) TO authenticated, service_role;
