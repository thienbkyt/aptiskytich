-- 1) Reclaim path must not park exhausted jobs back in 'pending' forever.
CREATE OR REPLACE FUNCTION public.claim_grading_jobs(_limit integer DEFAULT 5, _reclaim_after interval DEFAULT '00:10:00'::interval)
 RETURNS SETOF public.grading_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Reclaim stuck 'processing' jobs. Jobs that already burned every attempt
  -- become 'failed' (they can never be claimed again, so 'pending' = stuck).
  UPDATE public.grading_jobs
     SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
         claimed_at = NULL,
         finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE finished_at END,
         last_error = CASE WHEN attempts >= max_attempts
                           THEN COALESCE(last_error, 'stuck in processing, attempts exhausted')
                           ELSE last_error END,
         updated_at = now()
   WHERE status = 'processing'
     AND claimed_at IS NOT NULL
     AND claimed_at < now() - _reclaim_after;

  -- Any pending job that can no longer be claimed is dead, not waiting.
  UPDATE public.grading_jobs
     SET status = 'failed',
         claimed_at = NULL,
         finished_at = COALESCE(finished_at, now()),
         last_error = COALESCE(last_error, 'attempts exhausted'),
         updated_at = now()
   WHERE status = 'pending'
     AND attempts >= max_attempts;

  RETURN QUERY
  UPDATE public.grading_jobs g
     SET status = 'processing',
         claimed_at = now(),
         attempts = g.attempts + 1,
         updated_at = now()
   WHERE g.id IN (
     SELECT id
       FROM public.grading_jobs
      WHERE status = 'pending'
        AND attempts < max_attempts
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(1, LEAST(_limit, 20))
   )
  RETURNING g.*;
END;
$function$;

-- 2) Backfill: jobs already stranded in 'pending' with no attempts left.
UPDATE public.grading_jobs
   SET status = 'failed',
       claimed_at = NULL,
       finished_at = COALESCE(finished_at, now()),
       last_error = COALESCE(last_error, 'attempts exhausted'),
       updated_at = now()
 WHERE status IN ('pending', 'processing')
   AND attempts >= max_attempts;

-- 3) Learner-triggered retry of a FAILED job, capped at 2 per attempt.
CREATE OR REPLACE FUNCTION public.retry_failed_grading_job(p_job_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_job public.grading_jobs;
  v_retries int;
  v_pending int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_job
    FROM public.grading_jobs
   WHERE id = p_job_id
     AND (user_id = v_uid OR public.has_role(v_uid, 'admin'::public.app_role));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Only broken attempts may be re-graded; never a job that succeeded or is running.
  IF v_job.status <> 'failed' THEN
    RAISE EXCEPTION 'not_failed';
  END IF;

  v_retries := COALESCE((v_job.payload->>'_manualRetries')::int, 0);
  IF v_retries >= 2 THEN
    RAISE EXCEPTION 'retry_limit_reached';
  END IF;

  SELECT count(*) INTO v_pending
    FROM public.grading_jobs
   WHERE user_id = v_job.user_id AND status IN ('pending','processing');
  IF v_pending >= 8 THEN
    RAISE EXCEPTION 'too_many_pending_jobs';
  END IF;

  INSERT INTO public.grading_jobs (
    user_id, test_result_id, skill, part, status, attempts, max_attempts, payload, last_error
  ) VALUES (
    v_job.user_id, v_job.test_result_id, v_job.skill, v_job.part, 'pending', 0, v_job.max_attempts,
    jsonb_set(v_job.payload, '{_manualRetries}', to_jsonb(v_retries + 1), true),
    'manual retry'
  )
  RETURNING id INTO v_id;

  -- The old job is settled; keep it for audit but stop it counting as failed.
  UPDATE public.grading_jobs
     SET status = 'superseded', updated_at = now()
   WHERE id = v_job.id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.retry_failed_grading_job(uuid) TO authenticated;