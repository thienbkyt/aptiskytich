
-- INSERT policy: user can enqueue their own pending grading jobs
DROP POLICY IF EXISTS grading_jobs_insert_own ON public.grading_jobs;
CREATE POLICY grading_jobs_insert_own
  ON public.grading_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND attempts = 0
    AND claimed_at IS NULL
    AND finished_at IS NULL
  );

-- Ensure required extensions for scheduled worker invocation
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
