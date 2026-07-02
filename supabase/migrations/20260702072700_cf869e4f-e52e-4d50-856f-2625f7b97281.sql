ALTER TABLE public.exam_sets ADD COLUMN IF NOT EXISTS question_count integer NOT NULL DEFAULT 0;

UPDATE public.exam_sets s SET question_count = (SELECT count(*) FROM public.exam_questions q WHERE q.exam_set_id = s.id);

CREATE OR REPLACE FUNCTION public.recount_exam_set_questions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected uuid;
BEGIN
  affected := COALESCE(NEW.exam_set_id, OLD.exam_set_id);
  IF affected IS NOT NULL THEN
    UPDATE public.exam_sets s
    SET question_count = (SELECT count(*) FROM public.exam_questions q WHERE q.exam_set_id = affected)
    WHERE s.id = affected;
  END IF;
  IF (TG_OP = 'UPDATE' AND NEW.exam_set_id IS DISTINCT FROM OLD.exam_set_id) THEN
    UPDATE public.exam_sets s
    SET question_count = (SELECT count(*) FROM public.exam_questions q WHERE q.exam_set_id = OLD.exam_set_id)
    WHERE s.id = OLD.exam_set_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recount_exam_set_questions ON public.exam_questions;
CREATE TRIGGER trg_recount_exam_set_questions
AFTER INSERT OR UPDATE OR DELETE ON public.exam_questions
FOR EACH ROW EXECUTE FUNCTION public.recount_exam_set_questions();

REVOKE EXECUTE ON FUNCTION public.recount_exam_set_questions() FROM PUBLIC, anon, authenticated;