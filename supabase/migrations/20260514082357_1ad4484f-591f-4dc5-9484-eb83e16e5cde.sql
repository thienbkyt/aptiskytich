CREATE OR REPLACE FUNCTION public.get_db_size_mb()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (pg_database_size(current_database())::numeric / (1024 * 1024));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_storage_size_mb()
RETURNS TABLE(bucket_id TEXT, size_mb NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    o.bucket_id::text,
    (COALESCE(SUM((o.metadata->>'size')::bigint), 0)::numeric / (1024 * 1024)) AS size_mb
  FROM storage.objects o
  GROUP BY o.bucket_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_db_size_mb() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_storage_size_mb() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_db_size_mb() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_size_mb() TO authenticated, service_role;