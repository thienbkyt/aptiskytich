
-- =========================================================
-- 1. Dedupe existing rows before enforcing UNIQUE constraints
-- =========================================================
-- writing_question_gradings: keep newest per (test_result_id, part, item_index)
DELETE FROM public.writing_question_gradings a
USING public.writing_question_gradings b
WHERE a.test_result_id IS NOT NULL
  AND a.test_result_id = b.test_result_id
  AND a.part = b.part
  AND a.item_index = b.item_index
  AND a.created_at < b.created_at;

-- speaking_question_gradings
DELETE FROM public.speaking_question_gradings a
USING public.speaking_question_gradings b
WHERE a.test_result_id IS NOT NULL
  AND a.test_result_id = b.test_result_id
  AND a.part = b.part
  AND a.item_index = b.item_index
  AND a.created_at < b.created_at;

-- writing_skill_results: keep newest per (user_id, full_test_session_id)
DELETE FROM public.writing_skill_results a
USING public.writing_skill_results b
WHERE a.full_test_session_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.full_test_session_id = b.full_test_session_id
  AND a.created_at < b.created_at;

-- speaking_skill_results (uuid session id)
DELETE FROM public.speaking_skill_results a
USING public.speaking_skill_results b
WHERE a.full_test_session_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.full_test_session_id = b.full_test_session_id
  AND a.created_at < b.created_at;

-- =========================================================
-- 2. UNIQUE indexes (partial — nulls allowed / not deduped)
--    These support ON CONFLICT ... WHERE for upsert paths.
-- =========================================================
CREATE UNIQUE INDEX IF NOT EXISTS writing_question_gradings_uniq_part
  ON public.writing_question_gradings (test_result_id, part, item_index)
  WHERE test_result_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS speaking_question_gradings_uniq_part
  ON public.speaking_question_gradings (test_result_id, part, item_index)
  WHERE test_result_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS writing_skill_results_uniq_session
  ON public.writing_skill_results (user_id, full_test_session_id)
  WHERE full_test_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS speaking_skill_results_uniq_session
  ON public.speaking_skill_results (user_id, full_test_session_id)
  WHERE full_test_session_id IS NOT NULL;

-- =========================================================
-- 3. grading_jobs — durable queue for AI grading
-- =========================================================
CREATE TABLE IF NOT EXISTS public.grading_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  test_result_id  uuid REFERENCES public.test_results(id) ON DELETE CASCADE,
  skill           text NOT NULL CHECK (skill IN ('speaking','writing')),
  part            text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','done','failed')),
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  last_error      text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_response    jsonb,
  claimed_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.grading_jobs TO authenticated;
GRANT ALL ON public.grading_jobs TO service_role;

ALTER TABLE public.grading_jobs ENABLE ROW LEVEL SECURITY;

-- Users can see only their own jobs (for UI polling / "chấm lại" button)
CREATE POLICY grading_jobs_select_own
  ON public.grading_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can see everything (admin failed-jobs list)
CREATE POLICY grading_jobs_select_admin
  ON public.grading_jobs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins can requeue (update status back to pending, reset attempts)
CREATE POLICY grading_jobs_update_admin
  ON public.grading_jobs
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- NOTE: no INSERT policy for authenticated → only service_role/edge functions
-- may create jobs (submission goes through an edge function).

CREATE INDEX IF NOT EXISTS grading_jobs_status_created_idx
  ON public.grading_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS grading_jobs_user_created_idx
  ON public.grading_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS grading_jobs_test_result_idx
  ON public.grading_jobs (test_result_id);
CREATE INDEX IF NOT EXISTS grading_jobs_processing_idx
  ON public.grading_jobs (claimed_at)
  WHERE status = 'processing';

-- Updated_at trigger
DROP TRIGGER IF EXISTS grading_jobs_updated_at ON public.grading_jobs;
CREATE TRIGGER grading_jobs_updated_at
  BEFORE UPDATE ON public.grading_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. Atomic claim + reclaim function
--    - reclaims jobs stuck in 'processing' > reclaim_after
--    - picks up to _limit pending jobs (attempts < max_attempts)
--    - uses FOR UPDATE SKIP LOCKED so multiple workers never grab the same job
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_grading_jobs(
  _limit integer DEFAULT 5,
  _reclaim_after interval DEFAULT interval '10 minutes'
)
RETURNS SETOF public.grading_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Reclaim stuck 'processing' jobs
  UPDATE public.grading_jobs
     SET status = 'pending',
         claimed_at = NULL,
         updated_at = now()
   WHERE status = 'processing'
     AND claimed_at IS NOT NULL
     AND claimed_at < now() - _reclaim_after;

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
$$;

REVOKE ALL ON FUNCTION public.claim_grading_jobs(integer, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_grading_jobs(integer, interval) TO service_role;
