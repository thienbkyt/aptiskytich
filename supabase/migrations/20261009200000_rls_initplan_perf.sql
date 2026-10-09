-- Perf: RLS policies evaluated auth.uid()/has_role() per row, and the opened-items
-- policy could not use idx_uoi_user_item (full index scan per question row).
-- Wrapping in (select ...) makes them InitPlans (evaluated once) -> same semantics.
-- Listening Part 3 load: 2330ms -> 13ms. Applied 2026-10-09 via SQL.
-- Old definitions: identical but with bare auth.uid() / has_role(auth.uid(), ...) / current_user_tier().

alter policy "Read exam_questions via opened items" on public.exam_questions
  using (EXISTS ( SELECT 1 FROM (user_opened_items uoi JOIN exam_sets es ON ((es.id = exam_questions.exam_set_id)))
    WHERE ((uoi.user_id = (select auth.uid())) AND (uoi.item_key = (exam_questions.exam_set_id)::text) AND (es.is_published = true))));

alter policy "Read exam_questions by tier" on public.exam_questions
  using ((select has_role((select auth.uid()), 'admin'::app_role)) OR (EXISTS ( SELECT 1 FROM exam_sets es
    WHERE ((es.id = exam_questions.exam_set_id) AND (es.is_published = true)
      AND ((select tier_rank(user_tier((select auth.uid())))) >= tier_rank(COALESCE(es.access_tier, 'pro'::text)))))));

alter policy "Paid read prediction_items" on public.prediction_items
  using ((select has_role((select auth.uid()), 'admin'::app_role)) OR (EXISTS ( SELECT 1 FROM prediction_keys k
    WHERE ((k.id = prediction_items.key_id) AND (k.is_published = true)
      AND ((select tier_rank(current_user_tier())) >= tier_rank('pro'::text))))));
