CREATE OR REPLACE FUNCTION public.app_settings_touch_intro_video_since()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.intro_video_url IS DISTINCT FROM OLD.intro_video_url THEN
    NEW.intro_video_since := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_settings_intro_video_since ON public.app_settings;
CREATE TRIGGER trg_app_settings_intro_video_since
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.app_settings_touch_intro_video_since();

UPDATE public.app_settings SET intro_video_since = now() WHERE intro_video_url IS NOT NULL;