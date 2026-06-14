
-- 1) Revoke public/anon EXECUTE on SECURITY DEFINER functions that should not be callable by signed-out users.
--    Keep them callable by authenticated and service_role where needed.

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_db_size_mb() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_storage_size_mb() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- Ensure required callers retain access
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_db_size_mb() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_size_mb() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO authenticated, service_role;

-- 2) exam_gradings: admin SELECT policy
DROP POLICY IF EXISTS "Admins can read all exam gradings" ON public.exam_gradings;
CREATE POLICY "Admins can read all exam gradings"
  ON public.exam_gradings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) test_results: admin SELECT policy
DROP POLICY IF EXISTS "Admins can read all test results" ON public.test_results;
CREATE POLICY "Admins can read all test results"
  ON public.test_results
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) question_reports: allow users to read their own reports
DROP POLICY IF EXISTS "Users can read their own question reports" ON public.question_reports;
CREATE POLICY "Users can read their own question reports"
  ON public.question_reports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
