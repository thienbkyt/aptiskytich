CREATE UNIQUE INDEX IF NOT EXISTS grading_jobs_active_unique
  ON public.grading_jobs (test_result_id, part)
  WHERE status IN ('pending','processing') AND test_result_id IS NOT NULL;