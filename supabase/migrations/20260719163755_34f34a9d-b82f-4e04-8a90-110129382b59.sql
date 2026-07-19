
-- Fix 1: grading_jobs INSERT must ensure test_result_id (when present) belongs to auth.uid()
DROP POLICY IF EXISTS "grading_jobs_insert_own" ON public.grading_jobs;

CREATE POLICY "grading_jobs_insert_own"
ON public.grading_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND attempts = 0
  AND claimed_at IS NULL
  AND finished_at IS NULL
  AND (
    test_result_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.test_results tr
      WHERE tr.id = test_result_id
        AND tr.user_id = auth.uid()
    )
  )
);

-- Fix 2: site_visits INSERT validation — bound path/visitor_id length to reject spoofed/oversized analytics rows
DROP POLICY IF EXISTS "Anyone can insert visit" ON public.site_visits;

CREATE POLICY "Anyone can insert visit"
ON public.site_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (path IS NULL OR char_length(path) <= 512)
  AND (visitor_id IS NULL OR char_length(visitor_id) <= 128)
);
