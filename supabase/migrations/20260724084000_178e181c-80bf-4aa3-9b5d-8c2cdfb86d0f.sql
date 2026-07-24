
-- 1) Drop client UPDATE policies
DROP POLICY IF EXISTS "Users can update own streak" ON public.learning_streaks;
DROP POLICY IF EXISTS "speaking_skill_results_update_own" ON public.speaking_skill_results;
DROP POLICY IF EXISTS "Users can update their own writing skill results" ON public.writing_skill_results;

-- 2) Server-side upsert for speaking skill result
CREATE OR REPLACE FUNCTION public.finalize_speaking_skill_result(
  p_test_result_id uuid,
  p_exam_set_id uuid,
  p_full_test_session_id uuid,
  p_parts jsonb,
  p_raw_total numeric,
  p_scale50 numeric,
  p_cefr text,
  p_grey_zone boolean,
  p_flag_review boolean,
  p_feedback text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_full_test_session_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.speaking_skill_results
      WHERE user_id = v_uid AND full_test_session_id = p_full_test_session_id;
  ELSIF p_test_result_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.speaking_skill_results
      WHERE user_id = v_uid AND test_result_id = p_test_result_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.speaking_skill_results (
      user_id, test_result_id, exam_set_id, full_test_session_id,
      parts, raw_total, scale50, cefr, grey_zone, flag_review, feedback
    ) VALUES (
      v_uid, p_test_result_id, p_exam_set_id, p_full_test_session_id,
      p_parts, p_raw_total, p_scale50, p_cefr, p_grey_zone, p_flag_review, p_feedback
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.speaking_skill_results SET
      test_result_id = COALESCE(p_test_result_id, test_result_id),
      exam_set_id = COALESCE(p_exam_set_id, exam_set_id),
      parts = p_parts,
      raw_total = p_raw_total,
      scale50 = p_scale50,
      cefr = p_cefr,
      grey_zone = p_grey_zone,
      flag_review = p_flag_review,
      feedback = p_feedback
    WHERE id = v_id AND user_id = v_uid;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_speaking_skill_result(uuid,uuid,uuid,jsonb,numeric,numeric,text,boolean,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_speaking_skill_result(uuid,uuid,uuid,jsonb,numeric,numeric,text,boolean,boolean,text) TO authenticated;

-- 3) Server-side upsert for writing skill result
CREATE OR REPLACE FUNCTION public.finalize_writing_skill_result(
  p_test_result_id uuid,
  p_exam_set_id uuid,
  p_full_test_session_id text,
  p_parts jsonb,
  p_raw_total numeric,
  p_scale50 integer,
  p_cefr text,
  p_grey_zone boolean,
  p_flag_review boolean,
  p_feedback text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_full_test_session_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.writing_skill_results
      WHERE user_id = v_uid AND full_test_session_id = p_full_test_session_id;
  ELSIF p_test_result_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.writing_skill_results
      WHERE user_id = v_uid AND test_result_id = p_test_result_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.writing_skill_results (
      user_id, test_result_id, exam_set_id, full_test_session_id,
      parts, raw_total, scale50, cefr, grey_zone, flag_review, feedback
    ) VALUES (
      v_uid, p_test_result_id, p_exam_set_id, p_full_test_session_id,
      p_parts, p_raw_total, p_scale50, p_cefr, p_grey_zone, p_flag_review, p_feedback
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.writing_skill_results SET
      test_result_id = COALESCE(p_test_result_id, test_result_id),
      exam_set_id = COALESCE(p_exam_set_id, exam_set_id),
      parts = p_parts,
      raw_total = p_raw_total,
      scale50 = p_scale50,
      cefr = p_cefr,
      grey_zone = p_grey_zone,
      flag_review = p_flag_review,
      feedback = p_feedback,
      updated_at = now()
    WHERE id = v_id AND user_id = v_uid;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_writing_skill_result(uuid,uuid,text,jsonb,numeric,integer,text,boolean,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_writing_skill_result(uuid,uuid,text,jsonb,numeric,integer,text,boolean,boolean,text) TO authenticated;

-- 4) Server-side streak bump (computes state internally so users cannot inflate)
CREATE OR REPLACE FUNCTION public.bump_learning_streak()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_row public.learning_streaks%ROWTYPE;
  v_new_current int;
  v_new_longest int;
  v_diff int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.learning_streaks WHERE user_id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.learning_streaks (user_id, current_streak, longest_streak, last_activity_date)
      VALUES (v_uid, 1, 1, v_today);
    RETURN;
  END IF;

  IF v_row.last_activity_date = v_today THEN
    RETURN;
  END IF;

  v_diff := COALESCE(v_today - v_row.last_activity_date, 999);
  v_new_current := CASE WHEN v_diff = 1 THEN COALESCE(v_row.current_streak, 0) + 1 ELSE 1 END;
  v_new_longest := GREATEST(COALESCE(v_row.longest_streak, 0), v_new_current);

  UPDATE public.learning_streaks
     SET current_streak = v_new_current,
         longest_streak = v_new_longest,
         last_activity_date = v_today
   WHERE user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_learning_streak() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_learning_streak() TO authenticated;
