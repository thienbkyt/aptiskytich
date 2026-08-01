-- 1) Storage: require published exam sets
DROP POLICY IF EXISTS "Authenticated read audio tier gated" ON storage.objects;
CREATE POLICY "Authenticated read audio tier gated"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.exam_questions eq
      JOIN public.exam_sets es ON es.id = eq.exam_set_id
      WHERE eq.audio_url IS NOT NULL
        AND (eq.audio_url = objects.name OR objects.name = split_part(eq.audio_url, '/', -1))
        AND es.is_published = true
        AND public.tier_rank(public.user_tier(auth.uid())) >= public.tier_rank(COALESCE(es.access_tier, 'pro'))
    )
  )
);

DROP POLICY IF EXISTS "Authenticated read exam images tier gated" ON storage.objects;
CREATE POLICY "Authenticated read exam images tier gated"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-images'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.exam_questions eq
      JOIN public.exam_sets es ON es.id = eq.exam_set_id
      WHERE eq.image_url IS NOT NULL
        AND (eq.image_url = objects.name OR objects.name = split_part(eq.image_url, '/', -1))
        AND es.is_published = true
        AND public.tier_rank(public.user_tier(auth.uid())) >= public.tier_rank(COALESCE(es.access_tier, 'pro'))
    )
  )
);

DROP POLICY IF EXISTS "Authenticated read exam images extra_data gated" ON storage.objects;
CREATE POLICY "Authenticated read exam images extra_data gated"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-images'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.exam_questions eq
      JOIN public.exam_sets es ON es.id = eq.exam_set_id
      WHERE (
          (eq.extra_data ->> 'imageUrl1') = objects.name
          OR (eq.extra_data ->> 'imageUrl2') = objects.name
          OR objects.name = split_part(eq.extra_data ->> 'imageUrl1', '/', -1)
          OR objects.name = split_part(eq.extra_data ->> 'imageUrl2', '/', -1)
        )
        AND es.is_published = true
        AND public.tier_rank(public.user_tier(auth.uid())) >= public.tier_rank(COALESCE(es.access_tier, 'pro'))
    )
  )
);

-- 2) test_results: enforce column-level update restriction for clients
REVOKE UPDATE ON public.test_results FROM authenticated;
GRANT UPDATE (review_snapshot, grade_payload) ON public.test_results TO authenticated;
GRANT ALL ON public.test_results TO service_role;