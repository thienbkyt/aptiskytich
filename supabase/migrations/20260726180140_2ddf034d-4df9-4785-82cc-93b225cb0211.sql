
-- 1) Tighten question_reports insert validation
DROP POLICY IF EXISTS "Guests can submit reports" ON public.question_reports;
CREATE POLICY "Guests can submit reports"
ON public.question_reports
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND status = 'new'
  AND report_category IN ('content','functional')
  AND reason IN ('wrong_answer','audio','image','content','other','cant_nav','cant_exit','button_broken','page_frozen')
  AND (note IS NULL OR char_length(note) <= 2000)
  AND (page_url IS NULL OR char_length(page_url) <= 512)
  AND (device_info IS NULL OR char_length(device_info) <= 512)
  AND (section IS NULL OR char_length(section) <= 128)
  AND (skill IS NULL OR char_length(skill) <= 64)
  AND (part_type IS NULL OR char_length(part_type) <= 64)
);

DROP POLICY IF EXISTS "Users can insert their own reports" ON public.question_reports;
CREATE POLICY "Users can insert their own reports"
ON public.question_reports
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'new'
  AND report_category IN ('content','functional')
  AND reason IN ('wrong_answer','audio','image','content','other','cant_nav','cant_exit','button_broken','page_frozen')
  AND (note IS NULL OR char_length(note) <= 2000)
  AND (page_url IS NULL OR char_length(page_url) <= 512)
  AND (device_info IS NULL OR char_length(device_info) <= 512)
  AND (section IS NULL OR char_length(section) <= 128)
);

-- 2) Throttle trigger for question_reports
CREATE OR REPLACE FUNCTION public.throttle_question_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT count(*) INTO recent_count
    FROM public.question_reports
    WHERE user_id = NEW.user_id
      AND created_at > now() - interval '1 hour';
    IF recent_count >= 20 THEN
      RAISE EXCEPTION 'Too many reports submitted, please try again later';
    END IF;
  ELSE
    SELECT count(*) INTO recent_count
    FROM public.question_reports
    WHERE user_id IS NULL
      AND created_at > now() - interval '1 hour';
    IF recent_count >= 100 THEN
      RAISE EXCEPTION 'Too many reports submitted, please try again later';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS throttle_question_reports_trg ON public.question_reports;
CREATE TRIGGER throttle_question_reports_trg
BEFORE INSERT ON public.question_reports
FOR EACH ROW EXECUTE FUNCTION public.throttle_question_reports();

-- 3) Tighten site_visits insert validation
DROP POLICY IF EXISTS "Anyone can insert visit" ON public.site_visits;
CREATE POLICY "Anyone can insert visit"
ON public.site_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (
  path IS NOT NULL
  AND char_length(path) BETWEEN 1 AND 512
  AND path LIKE '/%'
  AND visitor_id IS NOT NULL
  AND char_length(visitor_id) BETWEEN 4 AND 128
);

-- 4) Throttle trigger for site_visits (per visitor per hour)
CREATE OR REPLACE FUNCTION public.throttle_site_visits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.site_visits
  WHERE visitor_id = NEW.visitor_id
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 60 THEN
    RAISE EXCEPTION 'Too many visit events';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS throttle_site_visits_trg ON public.site_visits;
CREATE TRIGGER throttle_site_visits_trg
BEFORE INSERT ON public.site_visits
FOR EACH ROW EXECUTE FUNCTION public.throttle_site_visits();

CREATE INDEX IF NOT EXISTS idx_site_visits_visitor_created ON public.site_visits (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_reports_user_created ON public.question_reports (user_id, created_at DESC);
