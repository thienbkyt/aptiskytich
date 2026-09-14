CREATE OR REPLACE FUNCTION public.list_old_speaking_recordings(
  _cutoff timestamptz,
  _cutoff_v2 timestamptz,
  _limit int
)
RETURNS TABLE(name text, is_v2 boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name::text,
         (o.created_at >= _cutoff) AS is_v2
  FROM storage.objects o
  WHERE o.bucket_id = 'speaking-recordings'
    AND (
      o.created_at < _cutoff
      OR (
        o.created_at >= _cutoff
        AND o.created_at < _cutoff_v2
        AND o.name ~ '^[0-9a-fA-F-]{32,}/[0-9a-fA-F-]{8,}/[^/]+/[^/]+\.webm$'
      )
    )
  ORDER BY o.created_at ASC
  LIMIT GREATEST(_limit, 0)
$$;

CREATE OR REPLACE FUNCTION public.count_old_speaking_recordings(_cutoff timestamptz)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM storage.objects o
  WHERE o.bucket_id = 'speaking-recordings'
    AND o.created_at < _cutoff
$$;

REVOKE ALL ON FUNCTION public.list_old_speaking_recordings(timestamptz, timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_old_speaking_recordings(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_old_speaking_recordings(timestamptz, timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_old_speaking_recordings(timestamptz) TO service_role;