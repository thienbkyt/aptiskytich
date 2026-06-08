ALTER TABLE public.test_results
  ADD COLUMN IF NOT EXISTS full_test_session_id uuid,
  ADD COLUMN IF NOT EXISTS full_test_id uuid;

CREATE INDEX IF NOT EXISTS idx_test_results_full_test_session
  ON public.test_results (user_id, full_test_session_id);
CREATE INDEX IF NOT EXISTS idx_test_results_full_test_id
  ON public.test_results (full_test_id);