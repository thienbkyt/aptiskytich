CREATE POLICY "Read exam images via opened items"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-images' AND EXISTS (
    SELECT 1 FROM public.exam_questions eq
    JOIN public.exam_sets es ON es.id = eq.exam_set_id
    JOIN public.user_opened_items uoi
      ON uoi.user_id = auth.uid() AND uoi.item_key = eq.exam_set_id::text
    WHERE es.is_published = true
      AND eq.image_url IS NOT NULL
      AND (eq.image_url = objects.name
           OR objects.name = split_part(eq.image_url, '/', -1))
  )
);

CREATE POLICY "Read exam images extra_data via opened items"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-images' AND EXISTS (
    SELECT 1 FROM public.exam_questions eq
    JOIN public.exam_sets es ON es.id = eq.exam_set_id
    JOIN public.user_opened_items uoi
      ON uoi.user_id = auth.uid() AND uoi.item_key = eq.exam_set_id::text
    WHERE es.is_published = true
      AND (
        (eq.extra_data ->> 'imageUrl1') = objects.name
        OR (eq.extra_data ->> 'imageUrl2') = objects.name
        OR objects.name = split_part((eq.extra_data ->> 'imageUrl1'), '/', -1)
        OR objects.name = split_part((eq.extra_data ->> 'imageUrl2'), '/', -1)
      )
  )
);

CREATE POLICY "Read exam audio via opened items"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'audio' AND EXISTS (
    SELECT 1 FROM public.exam_questions eq
    JOIN public.exam_sets es ON es.id = eq.exam_set_id
    JOIN public.user_opened_items uoi
      ON uoi.user_id = auth.uid() AND uoi.item_key = eq.exam_set_id::text
    WHERE es.is_published = true
      AND eq.audio_url IS NOT NULL
      AND (eq.audio_url = objects.name
           OR objects.name = split_part(eq.audio_url, '/', -1))
  )
);