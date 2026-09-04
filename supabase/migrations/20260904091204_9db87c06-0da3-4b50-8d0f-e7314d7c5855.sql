REVOKE ALL ON FUNCTION public.retry_failed_grading_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retry_failed_grading_job(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.retry_failed_grading_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_grading_job(uuid) TO service_role;