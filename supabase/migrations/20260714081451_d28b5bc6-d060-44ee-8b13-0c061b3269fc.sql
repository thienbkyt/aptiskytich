
CREATE OR REPLACE FUNCTION public.admin_ops_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sent int := 0;
  v_failed int := 0;
  v_dlq int := 0;
  v_speaking int := 0;
  v_writing int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    count(*) FILTER (WHERE status = 'sent'),
    count(*) FILTER (WHERE status = 'failed'),
    count(*) FILTER (WHERE status = 'dlq')
    INTO v_sent, v_failed, v_dlq
    FROM public.email_send_log
   WHERE (p_from IS NULL OR created_at >= p_from)
     AND (p_to IS NULL OR created_at <= p_to);

  SELECT count(DISTINCT test_result_id) INTO v_speaking
    FROM public.speaking_question_gradings
   WHERE test_result_id IS NOT NULL
     AND (p_from IS NULL OR created_at >= p_from)
     AND (p_to IS NULL OR created_at <= p_to);

  SELECT count(DISTINCT test_result_id) INTO v_writing
    FROM public.writing_question_gradings
   WHERE test_result_id IS NOT NULL
     AND (p_from IS NULL OR created_at >= p_from)
     AND (p_to IS NULL OR created_at <= p_to);

  RETURN jsonb_build_object(
    'email_sent', v_sent,
    'email_failed', v_failed,
    'email_dlq', v_dlq,
    'speaking_count', v_speaking,
    'writing_count', v_writing,
    'email_daily', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY (x.day) ASC)
      FROM (
        SELECT to_char((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
               count(*) FILTER (WHERE status = 'sent')::int AS sent,
               (count(*) FILTER (WHERE status IN ('failed','dlq')))::int AS failed
        FROM public.email_send_log
        WHERE (p_from IS NULL OR created_at >= p_from)
          AND (p_to IS NULL OR created_at <= p_to)
        GROUP BY 1
      ) x
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_ops_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ops_summary(timestamptz, timestamptz) TO authenticated;
