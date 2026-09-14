CREATE OR REPLACE FUNCTION public.claim_grading_jobs(_limit integer DEFAULT 8, _reclaim_after interval DEFAULT '00:03:00'::interval)
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

  -- Reclaim stuck 'processing' jobs. The function timed out before grading ever
  -- happened, so the attempt is refunded and the job is retried immediately.
  UPDATE public.grading_jobs
     SET status = 'pending',
         claimed_at = NULL,
         next_run_at = now(),
         attempts = GREATEST(attempts - 1, 0),
         updated_at = now()
   WHERE status = 'processing'
     AND claimed_at IS NOT NULL
     AND claimed_at < now() - _reclaim_after;

  -- Pending jobs that can no longer be claimed are dead, not waiting.
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
        AND next_run_at <= now()
      ORDER BY attempts ASC, (skill = 'speaking') ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(1, LEAST(_limit, 20))
   )
  RETURNING g.*;
END;
$function$;