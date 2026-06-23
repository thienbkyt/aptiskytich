REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer) TO service_role;