-- 1) feature_usage: server-side writes only
DROP POLICY IF EXISTS feature_usage_insert_own ON public.feature_usage;
REVOKE INSERT, UPDATE, DELETE ON public.feature_usage FROM authenticated;

-- 2) learning_streaks: only bump_learning_streak() (SECURITY DEFINER) may write
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='learning_streaks' AND cmd IN ('INSERT','UPDATE','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.learning_streaks', p.policyname);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.learning_streaks FROM authenticated;

-- 3) skill-level AI results: only finalize_*_skill_result() may write
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('writing_skill_results','speaking_skill_results')
      AND cmd IN ('INSERT','UPDATE','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.writing_skill_results FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.speaking_skill_results FROM authenticated;

-- 4) test_results: server-side sanity validation on insert
CREATE OR REPLACE FUNCTION public.validate_test_results_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total IS NULL OR NEW.total <= 0 OR NEW.total > 500 THEN
    RAISE EXCEPTION 'invalid total';
  END IF;
  IF NEW.score IS NULL OR NEW.score < 0 OR NEW.score > NEW.total THEN
    RAISE EXCEPTION 'invalid score';
  END IF;
  IF NEW.correct_answers IS NULL OR NEW.correct_answers < 0 OR NEW.correct_answers > NEW.total THEN
    RAISE EXCEPTION 'invalid correct_answers';
  END IF;
  IF NEW.level IS NULL OR NEW.level NOT IN ('A0','A1','A2','B1','B2','C1','C2') THEN
    RAISE EXCEPTION 'invalid level';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_test_results_insert ON public.test_results;
CREATE TRIGGER trg_validate_test_results_insert
BEFORE INSERT ON public.test_results
FOR EACH ROW EXECUTE FUNCTION public.validate_test_results_insert();

-- 5) per-question AI gradings: bound scores + CEFR whitelist
CREATE OR REPLACE FUNCTION public.validate_question_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.max_points IS NULL OR NEW.max_points <= 0 OR NEW.max_points > 100 THEN
    RAISE EXCEPTION 'invalid max_points';
  END IF;
  IF NEW.part_score IS NULL OR NEW.part_score < 0 OR NEW.part_score > NEW.max_points THEN
    RAISE EXCEPTION 'invalid part_score';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_writing_question_grading ON public.writing_question_gradings;
CREATE TRIGGER trg_validate_writing_question_grading
BEFORE INSERT OR UPDATE ON public.writing_question_gradings
FOR EACH ROW EXECUTE FUNCTION public.validate_question_grading();

DROP TRIGGER IF EXISTS trg_validate_speaking_question_grading ON public.speaking_question_gradings;
CREATE TRIGGER trg_validate_speaking_question_grading
BEFORE INSERT OR UPDATE ON public.speaking_question_gradings
FOR EACH ROW EXECUTE FUNCTION public.validate_question_grading();

CREATE OR REPLACE FUNCTION public.validate_exam_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.overall_level IS NULL OR NEW.overall_level NOT IN ('A0','A1','A2','B1','B2','C1','C2') THEN
    RAISE EXCEPTION 'invalid overall_level';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_exam_grading ON public.exam_gradings;
CREATE TRIGGER trg_validate_exam_grading
BEFORE INSERT ON public.exam_gradings
FOR EACH ROW EXECUTE FUNCTION public.validate_exam_grading();

-- 6) correctness is recomputed server-side from the stored answer key
CREATE OR REPLACE FUNCTION public.recompute_exam_question_correctness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ca integer;
BEGIN
  SELECT correct_answer INTO ca FROM public.exam_questions WHERE id = NEW.exam_question_id;
  IF ca IS NOT NULL AND NEW.user_answer ~ '^[0-9]+$' THEN
    NEW.is_correct := (NEW.user_answer::int = ca);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recompute_exam_question_correctness ON public.exam_question_results;
CREATE TRIGGER trg_recompute_exam_question_correctness
BEFORE INSERT OR UPDATE ON public.exam_question_results
FOR EACH ROW EXECUTE FUNCTION public.recompute_exam_question_correctness();

CREATE OR REPLACE FUNCTION public.recompute_user_answer_correctness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ca integer;
BEGIN
  SELECT correct_answer INTO ca FROM public.questions WHERE id = NEW.question_id;
  IF ca IS NOT NULL AND NEW.selected_answer ~ '^[0-9]+$' THEN
    NEW.is_correct := (NEW.selected_answer::int = ca);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recompute_user_answer_correctness ON public.user_answers;
CREATE TRIGGER trg_recompute_user_answer_correctness
BEFORE INSERT OR UPDATE ON public.user_answers
FOR EACH ROW EXECUTE FUNCTION public.recompute_user_answer_correctness();