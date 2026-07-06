-- Legacy 'questions' table: restrict SELECT to admins
DROP POLICY IF EXISTS "Authenticated can read questions" ON public.questions;
CREATE POLICY "Admins can read questions" ON public.questions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Legacy 'answers' table: restrict SELECT to admins (contains is_correct)
DROP POLICY IF EXISTS "Authenticated can read answers" ON public.answers;
CREATE POLICY "Admins can read answers" ON public.answers
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Legacy 'tests' table: remove public read, restrict to admins
DROP POLICY IF EXISTS "Anyone can read tests" ON public.tests;
CREATE POLICY "Admins can read tests" ON public.tests
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- feature_flags: restrict SELECT to admins (client uses check_feature_access RPC)
DROP POLICY IF EXISTS "select all authenticated" ON public.feature_flags;
CREATE POLICY "Admins can read feature_flags" ON public.feature_flags
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));