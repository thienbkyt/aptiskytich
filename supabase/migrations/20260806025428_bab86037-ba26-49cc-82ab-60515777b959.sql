CREATE OR REPLACE FUNCTION public.guard_grading_jobs_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_pending integer;
BEGIN
  -- Worker / service-role / cron inserts (no auth.uid()) are trusted.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'grading_jobs: cannot enqueue for another user';
  END IF;

  -- Quota gate: enqueueing a job WILL consume an AI grading run, so it must
  -- respect the same allowance the edge function checks.
  v_access := public.check_feature_access(
    CASE WHEN NEW.skill = 'speaking' THEN 'ai_grading_speaking' ELSE 'ai_grading_writing' END,
    NULL
  );
  IF COALESCE((v_access->>'allowed')::boolean, false) = false THEN
    RAISE EXCEPTION 'AI_QUOTA_EXCEEDED: %', COALESCE(v_access->>'reason', 'quota');
  END IF;

  -- Flood guard: a safety-net retry queue never needs many open jobs per user.
  SELECT COUNT(*) INTO v_pending
    FROM public.grading_jobs
   WHERE user_id = v_uid
     AND status IN ('pending', 'processing');
  IF v_pending >= 12 THEN
    RAISE EXCEPTION 'grading_jobs: too many pending jobs';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_grading_jobs_insert_trg ON public.grading_jobs;
CREATE TRIGGER guard_grading_jobs_insert_trg
BEFORE INSERT ON public.grading_jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_grading_jobs_insert();