-- Remove the permissive authenticated UPDATE policy on test_results.
-- Score-bearing fields must only be written through trusted SECURITY DEFINER RPCs;
-- the existing guard_test_results_update trigger already blocks client-side changes
-- to those fields. Dropping the policy closes the remaining direct update surface.
DROP POLICY IF EXISTS "Users can update own results" ON public.test_results;
DROP POLICY IF EXISTS "Users can update own results (snapshot only)" ON public.test_results;

-- Re-apply tight column-level grants in case they drifted.
REVOKE UPDATE ON public.test_results FROM authenticated;
GRANT UPDATE (review_snapshot, grade_payload) ON public.test_results TO authenticated;
GRANT ALL ON public.test_results TO service_role;