DROP POLICY IF EXISTS grading_jobs_insert_own ON public.grading_jobs;
REVOKE INSERT ON public.grading_jobs FROM authenticated;
GRANT ALL ON public.grading_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_grading_job(
  p_skill text,
  p_part text,
  p_payload jsonb,
  p_test_result_id uuid DEFAULT NULL,
  p_last_error text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_key text;
  v_ref text;
  v_gate jsonb;
  v_pending int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF p_skill NOT IN ('writing','speaking') THEN
    RAISE EXCEPTION 'invalid_skill';
  END IF;
  IF p_part IS NULL OR length(p_part) > 40 THEN
    RAISE EXCEPTION 'invalid_part';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  IF p_test_result_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.test_results tr
     WHERE tr.id = p_test_result_id AND tr.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Throttle: at most 8 waiting jobs per learner.
  SELECT count(*) INTO v_pending
    FROM public.grading_jobs
   WHERE user_id = v_uid AND status IN ('pending','processing');
  IF v_pending >= 8 THEN
    RAISE EXCEPTION 'too_many_pending_jobs';
  END IF;

  v_key := 'ai_grading_' || p_skill;
  v_ref := NULLIF(p_payload->>'gradingSessionId', '');

  -- Quota must be enforced here: direct table inserts are no longer allowed.
  -- An attempt that already consumed a grading slot may always be retried.
  IF v_ref IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.feature_usage fu
     WHERE fu.user_id = v_uid
       AND fu.feature_key IN ('ai_grading_writing','ai_grading_speaking')
       AND fu.ref_id = v_ref
  ) THEN
    v_gate := public.check_feature_access(v_key, NULL);
    IF COALESCE((v_gate->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'quota_exceeded';
    END IF;
  END IF;

  INSERT INTO public.grading_jobs (
    user_id, test_result_id, skill, part, status, attempts, max_attempts, payload, last_error
  ) VALUES (
    v_uid, p_test_result_id, p_skill, p_part, 'pending', 0, 3, p_payload, left(COALESCE(p_last_error,''), 500)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_grading_job(text, text, jsonb, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_grading_job(text, text, jsonb, uuid, text) TO authenticated;