CREATE OR REPLACE FUNCTION public.claim_grading_jobs(_limit integer DEFAULT 8, _reclaim_after interval DEFAULT '00:03:00'::interval)
 RETURNS SETOF grading_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Bước 1: Đếm lần job bị kẹt trong processing.
  UPDATE public.grading_jobs
     SET requeue_count = requeue_count + 1,
         updated_at = now()
   WHERE status = 'processing'
     AND claimed_at IS NOT NULL
     AND claimed_at < now() - _reclaim_after;

  -- Bước 2: Job kẹt >= 3 lần là lỗi nghiêm trọng, đánh failed để không giết function mãi.
  UPDATE public.grading_jobs
     SET status = 'failed',
         claimed_at = NULL,
         finished_at = now(),
         last_error = 'stuck in processing 3 lần (function bị kill?)',
         updated_at = now()
   WHERE status = 'processing'
     AND requeue_count >= 3;

  -- Bước 3: Các job kẹt còn lại được hoàn attempts và đưa về pending ngay.
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

-- Giữ nguyên quyền execute hiện tại.
GRANT EXECUTE ON FUNCTION public.claim_grading_jobs TO service_role, authenticated, anon;