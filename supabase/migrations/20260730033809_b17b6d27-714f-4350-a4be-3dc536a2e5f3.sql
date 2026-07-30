-- 1) site_visits: restrict reads to admins only, harden anonymous inserts
REVOKE SELECT, UPDATE, DELETE ON public.site_visits FROM anon;
REVOKE UPDATE, DELETE ON public.site_visits FROM authenticated;
GRANT INSERT ON public.site_visits TO anon, authenticated;
GRANT ALL ON public.site_visits TO service_role;

DROP POLICY IF EXISTS "Anyone can insert visit" ON public.site_visits;
CREATE POLICY "Anyone can insert visit"
ON public.site_visits FOR INSERT TO anon, authenticated
WITH CHECK (
  path IS NOT NULL
  AND char_length(path) BETWEEN 1 AND 512
  AND path ~ '^/[A-Za-z0-9\-_/\.\?=&%]*$'
  AND visitor_id IS NOT NULL
  AND char_length(visitor_id) BETWEEN 4 AND 128
  AND visitor_id ~ '^[A-Za-z0-9\-_]+$'
);

CREATE OR REPLACE FUNCTION public.throttle_site_visits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
  global_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.site_visits
  WHERE visitor_id = NEW.visitor_id
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Too many visit events';
  END IF;

  SELECT count(*) INTO global_count
  FROM public.site_visits
  WHERE created_at > now() - interval '1 minute';
  IF global_count >= 300 THEN
    RAISE EXCEPTION 'Visit logging temporarily throttled';
  END IF;

  NEW.created_at := now();
  RETURN NEW;
END;
$function$;

-- 2) tts-cache: explicit, least-privilege storage policies
DROP POLICY IF EXISTS "Public read tts-cache" ON storage.objects;
CREATE POLICY "Public read tts-cache"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'tts-cache');

DROP POLICY IF EXISTS "Service role delete tts-cache" ON storage.objects;
CREATE POLICY "Service role delete tts-cache"
ON storage.objects FOR DELETE
USING (bucket_id = 'tts-cache' AND auth.role() = 'service_role');