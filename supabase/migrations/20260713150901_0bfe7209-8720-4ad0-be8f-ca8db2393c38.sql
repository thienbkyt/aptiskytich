
-- 1. Normalize existing part labels to canonical (task1..task4 for writing, part1..part4 for speaking)
UPDATE public.writing_question_gradings
SET part = CASE
  WHEN part ILIKE 'part 1%' OR part ILIKE '%Short Answers%' OR part ILIKE '%Word-level%' THEN 'task1'
  WHEN part ILIKE 'part 2%' OR part ILIKE '%Short Text%' OR part ILIKE '%Social Media%' THEN 'task2'
  WHEN part ILIKE 'part 3%' OR part ILIKE '%Three%' THEN 'task3'
  WHEN part ILIKE 'part 4%' OR part ILIKE '%Email%' THEN 'task4'
  ELSE part
END
WHERE part NOT IN ('task1','task2','task3','task4');

UPDATE public.speaking_question_gradings
SET part = CASE
  WHEN part ILIKE 'part 1%' OR part ILIKE '%Personal%' THEN 'part1'
  WHEN part ILIKE 'part 2%' OR part ILIKE '%Describe%' THEN 'part2'
  WHEN part ILIKE 'part 3%' OR part ILIKE '%Compare%' THEN 'part3'
  WHEN part ILIKE 'part 4%' OR part ILIKE '%Abstract%' THEN 'part4'
  ELSE part
END
WHERE part NOT IN ('part1','part2','part3','part4');

-- 2. Replace PARTIAL unique indexes with FULL unique indexes so ON CONFLICT works.
DROP INDEX IF EXISTS public.writing_question_gradings_uniq_part;
DROP INDEX IF EXISTS public.speaking_question_gradings_uniq_part;
DROP INDEX IF EXISTS public.writing_skill_results_uniq_session;
DROP INDEX IF EXISTS public.writing_skill_results_uniq_trid;
DROP INDEX IF EXISTS public.speaking_skill_results_uniq_session;
DROP INDEX IF EXISTS public.speaking_skill_results_uniq_trid;

-- Recreate as FULL unique indexes (no WHERE clause) so PostgREST .upsert() with
-- ON CONFLICT can use them. NULL values in the target columns are treated as
-- distinct by Postgres, so this is safe when test_result_id / session id can be NULL.
CREATE UNIQUE INDEX writing_question_gradings_uniq_part
  ON public.writing_question_gradings (test_result_id, part, item_index);

CREATE UNIQUE INDEX speaking_question_gradings_uniq_part
  ON public.speaking_question_gradings (test_result_id, part, item_index);

CREATE UNIQUE INDEX writing_skill_results_uniq_session
  ON public.writing_skill_results (user_id, full_test_session_id);

CREATE UNIQUE INDEX writing_skill_results_uniq_trid
  ON public.writing_skill_results (user_id, test_result_id);

CREATE UNIQUE INDEX speaking_skill_results_uniq_session
  ON public.speaking_skill_results (user_id, full_test_session_id);

CREATE UNIQUE INDEX speaking_skill_results_uniq_trid
  ON public.speaking_skill_results (user_id, test_result_id);
