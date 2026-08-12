DROP TABLE IF EXISTS public.backup_chinh_ta_20260812;
DROP TABLE IF EXISTS public.backup_colloc_de01_20260812;
DROP TABLE IF EXISTS public.backup_vocab_de01_20260812;
DROP TABLE IF EXISTS public.backup_wp1_homeliving_20260811;
DROP TABLE IF EXISTS public.backup_wp1_mau_lech_20260811;
DROP TABLE IF EXISTS public.backup_wp3_homeliving_20260812;
DROP TABLE IF EXISTS public.tmp_key12;
DROP TABLE IF EXISTS public.tmp_rathi_1108;

DROP POLICY IF EXISTS "er_auth_read" ON public.exam_reviews;
CREATE POLICY "er_own_read" ON public.exam_reviews
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "eri_auth_read" ON public.exam_review_items;
CREATE POLICY "eri_own_read" ON public.exam_review_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exam_reviews r
    WHERE r.id = exam_review_items.review_id
      AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);