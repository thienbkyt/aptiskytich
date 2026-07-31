GRANT SELECT ON public.exam_sets TO anon;
GRANT SELECT ON public.full_tests TO anon;
GRANT SELECT ON public.full_test_members TO anon;

DROP POLICY IF EXISTS "Published exam_sets readable; admins read all" ON public.exam_sets;
CREATE POLICY "Published exam_sets readable; admins read all"
ON public.exam_sets FOR SELECT TO anon, authenticated
USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Published full_tests readable; admins read all" ON public.full_tests;
CREATE POLICY "Published full_tests readable; admins read all"
ON public.full_tests FOR SELECT TO anon, authenticated
USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Published full_test_members readable by users" ON public.full_test_members;
CREATE POLICY "Published full_test_members readable by users"
ON public.full_test_members FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.full_tests ft
  WHERE ft.id = full_test_members.full_test_id
    AND (ft.is_published = true OR has_role(auth.uid(), 'admin'::app_role))
));