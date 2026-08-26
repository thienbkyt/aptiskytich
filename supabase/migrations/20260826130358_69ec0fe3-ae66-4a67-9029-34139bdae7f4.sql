DROP POLICY IF EXISTS "Users can insert own results" ON public.test_results;
REVOKE INSERT ON public.test_results FROM authenticated;