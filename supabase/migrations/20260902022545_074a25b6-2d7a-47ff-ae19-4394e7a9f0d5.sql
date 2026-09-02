CREATE OR REPLACE FUNCTION public.prevent_test_results_score_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- service_role (edge functions / SECURITY DEFINER grading RPCs) can change anything
  IF current_setting('role', true) = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF NEW.score IS DISTINCT FROM OLD.score
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.correct_answers IS DISTINCT FROM OLD.correct_answers
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.skill_scores IS DISTINCT FROM OLD.skill_scores
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Score fields cannot be modified directly';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_test_results_no_score_tampering ON public.test_results;
CREATE TRIGGER trg_test_results_no_score_tampering
BEFORE UPDATE ON public.test_results
FOR EACH ROW EXECUTE FUNCTION public.prevent_test_results_score_tampering();

REVOKE EXECUTE ON FUNCTION public.prevent_test_results_score_tampering() FROM anon, authenticated;