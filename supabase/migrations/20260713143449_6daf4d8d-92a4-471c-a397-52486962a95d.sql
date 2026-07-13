
-- Fallback UNIQUE keys for skill_results so worker can upsert even when
-- full_test_session_id is NULL (single-part attempts or legacy rows).
-- Dedupe first: keep newest per (user_id, test_result_id).
DELETE FROM public.writing_skill_results a
USING public.writing_skill_results b
WHERE a.test_result_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.test_result_id = b.test_result_id
  AND a.created_at < b.created_at;

DELETE FROM public.speaking_skill_results a
USING public.speaking_skill_results b
WHERE a.test_result_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.test_result_id = b.test_result_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS writing_skill_results_uniq_trid
  ON public.writing_skill_results (user_id, test_result_id)
  WHERE test_result_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS speaking_skill_results_uniq_trid
  ON public.speaking_skill_results (user_id, test_result_id)
  WHERE test_result_id IS NOT NULL;
