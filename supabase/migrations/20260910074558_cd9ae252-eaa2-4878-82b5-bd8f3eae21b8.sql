ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS intro_video_url text,
  ADD COLUMN IF NOT EXISTS intro_video_title text DEFAULT 'Xem nhanh cách dùng Aptis Kỳ Tích',
  ADD COLUMN IF NOT EXISTS intro_video_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intro_video_since timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intro_video_seen_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'UPDATE'
      AND qual ILIKE '%auth.uid()%'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_intro_video()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'url', s.intro_video_url,
    'title', s.intro_video_title,
    'enabled', COALESCE(s.intro_video_enabled, false),
    'since', s.intro_video_since
  )
  FROM public.app_settings s
  WHERE s.id = 1
$$;

GRANT EXECUTE ON FUNCTION public.get_intro_video() TO anon, authenticated;