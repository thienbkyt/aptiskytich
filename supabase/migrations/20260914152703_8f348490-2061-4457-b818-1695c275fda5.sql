-- 1) Retry scheduling columns
ALTER TABLE public.grading_jobs
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS requeue_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.grading_jobs ALTER COLUMN max_attempts SET DEFAULT 6;

UPDATE public.grading_jobs
   SET max_attempts = 6
 WHERE max_attempts < 6
   AND status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS grading_jobs_pending_next_run_idx
  ON public.grading_jobs (next_run_at)
  WHERE status = 'pending';

-- 2) Claim only jobs whose backoff has elapsed
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

  -- Reclaim stuck 'processing' jobs: back to pending with a backoff, unless
  -- every attempt is spent (then they are genuinely dead).
  UPDATE public.grading_jobs
     SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
         claimed_at = NULL,
         next_run_at = CASE WHEN attempts >= max_attempts
                            THEN next_run_at
                            ELSE now() + (interval '10 minutes' * GREATEST(attempts, 1)) END,
         finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE finished_at END,
         last_error = CASE WHEN attempts >= max_attempts
                           THEN COALESCE(last_error, 'stuck in processing, attempts exhausted')
                           ELSE last_error END,
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
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(1, LEAST(_limit, 20))
   )
  RETURNING g.*;
END;
$function$;

-- 3) Learner/admin requeue of every failed job of one attempt (max 3 per job)
CREATE OR REPLACE FUNCTION public.requeue_grading_jobs(_test_result_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.test_results WHERE id = _test_result_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_owner <> v_uid AND NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH reset AS (
    UPDATE public.grading_jobs
       SET status = 'pending',
           attempts = 0,
           next_run_at = now(),
           claimed_at = NULL,
           finished_at = NULL,
           last_error = NULL,
           requeue_count = requeue_count + 1,
           max_attempts = GREATEST(max_attempts, 6),
           updated_at = now()
     WHERE test_result_id = _test_result_id
       AND status = 'failed'
       AND requeue_count < 3
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM reset;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.requeue_grading_jobs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_grading_jobs(uuid) TO authenticated, service_role;

-- 4) Log TTL sweeper (daily 03:30)
CREATE OR REPLACE FUNCTION public.cleanup_logs_ttl()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_usage integer := 0;
  v_batch integer;
  v_errors integer := 0;
  i integer;
BEGIN
  FOR i IN 1..10 LOOP
    WITH del AS (
      DELETE FROM public.usage_events
       WHERE id IN (
         SELECT id FROM public.usage_events
          WHERE created_at < now() - interval '90 days'
          LIMIT 20000
       )
      RETURNING 1
    )
    SELECT count(*) INTO v_batch FROM del;
    v_usage := v_usage + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  WITH del2 AS (
    DELETE FROM public.client_error_logs
     WHERE created_at < now() - interval '60 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_errors FROM del2;

  RETURN jsonb_build_object('usage_events_deleted', v_usage, 'client_error_logs_deleted', v_errors);
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_logs_ttl() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_logs_ttl() TO service_role;

SELECT cron.schedule('cleanup-logs-ttl', '30 3 * * *', $$SELECT public.cleanup_logs_ttl();$$);

-- 5) Expire stale pending payments (daily 04:00). Revenue reporting and tier
-- granting count status='paid' only, so 'expired' is inert for them.
SELECT cron.schedule(
  'expire-stale-pending-payments',
  '0 4 * * *',
  $$UPDATE public.payments
       SET status = 'expired'
     WHERE status = 'pending'
       AND paid_at IS NULL
       AND created_at < now() - interval '3 days';$$
);