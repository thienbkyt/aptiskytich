-- exam_sets
DROP POLICY IF EXISTS "Published exam_sets readable; admins read all" ON public.exam_sets;
CREATE POLICY "Published exam_sets readable; admins read all"
ON public.exam_sets FOR SELECT TO authenticated
USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.exam_sets FROM anon;

-- full_tests
DROP POLICY IF EXISTS "Published full_tests readable; admins read all" ON public.full_tests;
CREATE POLICY "Published full_tests readable; admins read all"
ON public.full_tests FOR SELECT TO authenticated
USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.full_tests FROM anon;

-- full_test_members
DROP POLICY IF EXISTS "Anyone can read published full_test_members" ON public.full_test_members;
CREATE POLICY "Published full_test_members readable by users"
ON public.full_test_members FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.full_tests ft WHERE ft.id = full_test_members.full_test_id AND ft.is_published = true)
  OR has_role(auth.uid(), 'admin'::app_role)
);
REVOKE SELECT ON public.full_test_members FROM anon;

-- email_unsubscribe_tokens: no direct client access at all; validation only server-side
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon;
REVOKE ALL ON public.email_unsubscribe_tokens FROM authenticated;
GRANT SELECT ON public.email_unsubscribe_tokens TO authenticated; -- admin-only via RLS policy
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;