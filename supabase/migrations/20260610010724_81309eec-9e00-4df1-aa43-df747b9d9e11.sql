DROP POLICY IF EXISTS "Anyone can read full_test_members" ON public.full_test_members;
CREATE POLICY "Anyone can read published full_test_members" ON public.full_test_members
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.full_tests ft WHERE ft.id = full_test_members.full_test_id AND ft.is_published = true)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);