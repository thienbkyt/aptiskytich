CREATE TABLE IF NOT EXISTS public.backup_audio_policies_20260805 (
  id uuid primary key default gen_random_uuid(),
  policyname text not null,
  cmd text,
  qual text,
  saved_at timestamptz not null default now()
);
GRANT ALL ON public.backup_audio_policies_20260805 TO service_role;
ALTER TABLE public.backup_audio_policies_20260805 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audio policy backup" ON public.backup_audio_policies_20260805
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.backup_audio_policies_20260805 (policyname, cmd, qual)
SELECT policyname, cmd, qual FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname IN ('Authenticated read audio tier gated','Read exam audio via opened items');

CREATE INDEX IF NOT EXISTS idx_exam_questions_audio_url
  ON public.exam_questions(audio_url) WHERE audio_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_sign_audio(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM exam_questions eq
    JOIN exam_sets es ON es.id = eq.exam_set_id
    WHERE eq.audio_url = p_name
      AND es.is_published = true
      AND (
        tier_rank(user_tier(auth.uid())) >= tier_rank(coalesce(es.access_tier,'pro'))
        OR EXISTS (
          SELECT 1 FROM user_opened_items u
          WHERE u.user_id = auth.uid() AND u.item_key = eq.exam_set_id::text
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Authenticated read audio tier gated" ON storage.objects;
DROP POLICY IF EXISTS "Read exam audio via opened items" ON storage.objects;

CREATE POLICY "Read exam audio gated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio' AND public.can_sign_audio(name));