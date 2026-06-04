
-- Restrict draft exam sets and full tests to admins
DROP POLICY IF EXISTS "Anyone can read exam_sets" ON public.exam_sets;
CREATE POLICY "Published exam_sets readable; admins read all"
ON public.exam_sets FOR SELECT
USING (is_published = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read full_tests" ON public.full_tests;
CREATE POLICY "Published full_tests readable; admins read all"
ON public.full_tests FOR SELECT
USING (is_published = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- Restrict system_vocab_words to words from published sets (admins see all)
DROP POLICY IF EXISTS "Anyone can read vocab words" ON public.system_vocab_words;
CREATE POLICY "Published vocab words readable; admins read all"
ON public.system_vocab_words FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.system_vocab_sets s
    WHERE s.id = system_vocab_words.vocab_set_id
      AND s.is_published = true
  )
);

-- Allow admins to read email operational tables
CREATE POLICY "Admins can read email_send_log"
ON public.email_send_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read email_unsubscribe_tokens"
ON public.email_unsubscribe_tokens FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read suppressed_emails"
ON public.suppressed_emails FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Revoke EXECUTE on admin-only SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.get_db_size_mb() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_storage_size_mb() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_db_size_mb() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_size_mb() TO service_role;
