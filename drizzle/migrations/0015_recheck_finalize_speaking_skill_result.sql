-- Ghi lại public.finalize_speaking_skill_result đang chạy trong DB.
-- Khác so với bản cũ: khi không tìm thấy theo full_test_session_id, tìm thêm
-- theo (user_id, test_result_id); nếu thấy thì UPDATE (kèm set
-- full_test_session_id = COALESCE(p_full_test_session_id, full_test_session_id))
-- thay vì INSERT — tránh trùng unique (user_id, test_result_id) khi part cuối
-- được worker chấm nền.
create or replace function public.finalize_speaking_skill_result(
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
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_full_test_session_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.speaking_skill_results
      WHERE user_id = v_uid AND full_test_session_id = p_full_test_session_id;
  END IF;
  -- Dòng lẻ do worker ghi theo test_result_id (part cuối bị chấm nền) → tái dùng, tránh trùng unique (user_id, test_result_id)
  IF v_id IS NULL AND p_test_result_id IS NOT NULL THEN
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
      full_test_session_id = COALESCE(p_full_test_session_id, full_test_session_id),
      parts = p_parts, raw_total = p_raw_total, scale50 = p_scale50, cefr = p_cefr,
      grey_zone = p_grey_zone, flag_review = p_flag_review, feedback = p_feedback
    WHERE id = v_id AND user_id = v_uid;
  END IF;
  RETURN v_id;
END;
$$;