
-- 1. Restrict answers SELECT to authenticated users (hide is_correct from anon)
DROP POLICY IF EXISTS "Anyone can read answers" ON public.answers;
CREATE POLICY "Authenticated can read answers"
  ON public.answers FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.answers FROM anon;

-- 2. Lock down SECURITY DEFINER functions in the public schema.
-- Trigger functions should not be callable via the Data API at all.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Email queue helpers are service-role only.
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Admin-only metrics: revoke anon; keep authenticated (function already checks has_role).
REVOKE ALL ON FUNCTION public.get_db_size_mb() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_db_size_mb() TO authenticated;
REVOKE ALL ON FUNCTION public.get_storage_size_mb() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_storage_size_mb() TO authenticated;

-- has_role is used by RLS policies; authenticated needs EXECUTE. Revoke anon.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
