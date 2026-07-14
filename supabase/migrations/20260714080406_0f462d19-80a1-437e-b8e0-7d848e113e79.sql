
DROP POLICY IF EXISTS "Authenticated read audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read audio tier gated" ON storage.objects;

CREATE POLICY "Authenticated read audio tier gated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.exam_questions eq
      JOIN public.exam_sets es ON es.id = eq.exam_set_id
      WHERE eq.audio_url IS NOT NULL
        AND (
          eq.audio_url = storage.objects.name
          OR storage.objects.name = split_part(eq.audio_url, '/', -1)
        )
        AND public.tier_rank(public.user_tier(auth.uid()))
            >= public.tier_rank(COALESCE(es.access_tier, 'pro'))
    )
  )
);

DROP POLICY IF EXISTS "Authenticated read exam-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read exam images tier gated" ON storage.objects;

CREATE POLICY "Authenticated read exam images tier gated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-images' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.exam_questions eq
      JOIN public.exam_sets es ON es.id = eq.exam_set_id
      WHERE eq.image_url IS NOT NULL
        AND (
          eq.image_url = storage.objects.name
          OR storage.objects.name = split_part(eq.image_url, '/', -1)
        )
        AND public.tier_rank(public.user_tier(auth.uid()))
            >= public.tier_rank(COALESCE(es.access_tier, 'pro'))
    )
  )
);
