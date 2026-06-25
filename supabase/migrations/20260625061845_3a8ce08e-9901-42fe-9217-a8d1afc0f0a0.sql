
-- 1) Revoke enqueue_email from authenticated (trigger uses SECURITY DEFINER so still works)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;

-- 2) Revoke SECURITY DEFINER tier helpers from anon (and PUBLIC)
REVOKE EXECUTE ON FUNCTION public.user_tier(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_tier() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC, anon;

-- 3) Fix mutable search_path on tier_rank
ALTER FUNCTION public.tier_rank(text) SET search_path = public;

-- 4) HTML-escape user-supplied note in admin email
CREATE OR REPLACE FUNCTION public.notify_admin_on_question_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason_vi text;
  v_subject text;
  v_html text;
  v_text text;
  v_note text;
  v_note_html text;
  v_message_id text;
BEGIN
  BEGIN
    v_reason_vi := CASE NEW.reason
      WHEN 'wrong_answer' THEN 'Sai đáp án'
      WHEN 'audio' THEN 'Lỗi audio'
      WHEN 'image' THEN 'Lỗi hình ảnh'
      WHEN 'content' THEN 'Lỗi nội dung'
      WHEN 'other' THEN 'Khác'
      ELSE COALESCE(NEW.reason, '(không xác định)')
    END;

    v_note := COALESCE(NULLIF(btrim(NEW.note), ''), '(không có ghi chú)');

    -- HTML-escape before embedding in email
    v_note_html := replace(
                     replace(
                       replace(
                         replace(
                           replace(v_note, '&', '&amp;'),
                         '<', '&lt;'),
                       '>', '&gt;'),
                     '"', '&quot;'),
                   '''', '&#39;');
    v_note_html := replace(v_note_html, E'\n', '<br>');

    v_message_id := 'question-report-' || NEW.id::text;

    v_subject := '🚩 Báo lỗi mới — ' || COALESCE(NEW.skill, '') || ' ' ||
                 COALESCE(NEW.part_type, '') || ' câu ' ||
                 COALESCE(NEW.question_number::text, '');

    v_html :=
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0F0F10;line-height:1.6">' ||
        '<h2 style="color:#CC1C01;margin:0 0 16px">🚩 Báo lỗi câu hỏi mới</h2>' ||
        '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse">' ||
          '<tr><td><b>Loại lỗi:</b></td><td>' || v_reason_vi || '</td></tr>' ||
          '<tr><td><b>Kỹ năng:</b></td><td>' || COALESCE(NEW.skill, '') || '</td></tr>' ||
          '<tr><td><b>Part:</b></td><td>' || COALESCE(NEW.part_type, '') || '</td></tr>' ||
          '<tr><td><b>Câu số:</b></td><td>' || COALESCE(NEW.question_number::text, '') || '</td></tr>' ||
          '<tr><td valign="top"><b>Ghi chú:</b></td><td>' || v_note_html || '</td></tr>' ||
          '<tr><td><b>exam_question_id:</b></td><td><code>' || COALESCE(NEW.exam_question_id::text, '(null)') || '</code></td></tr>' ||
          '<tr><td><b>exam_set_id:</b></td><td><code>' || COALESCE(NEW.exam_set_id::text, '(null)') || '</code></td></tr>' ||
          '<tr><td><b>Thời gian:</b></td><td>' || to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI:SS TZ') || '</td></tr>' ||
        '</table>' ||
        '<p style="margin-top:20px">👉 Vào <a href="https://aptiskytich.vn/admin/reports">/admin/reports</a> để xem và xử lý.</p>' ||
      '</div>';

    v_text :=
      'Báo lỗi câu hỏi mới' || E'\n' ||
      'Loại lỗi: ' || v_reason_vi || E'\n' ||
      'Kỹ năng: ' || COALESCE(NEW.skill, '') || E'\n' ||
      'Part: ' || COALESCE(NEW.part_type, '') || E'\n' ||
      'Câu số: ' || COALESCE(NEW.question_number::text, '') || E'\n' ||
      'Ghi chú: ' || v_note || E'\n' ||
      'exam_question_id: ' || COALESCE(NEW.exam_question_id::text, '(null)') || E'\n' ||
      'exam_set_id: ' || COALESCE(NEW.exam_set_id::text, '(null)') || E'\n' ||
      'Thời gian: ' || to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI:SS TZ') || E'\n\n' ||
      'Vào https://aptiskytich.vn/admin/reports để xem và xử lý.';

    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'message_id', v_message_id,
        'to', 'khanhthien4698@gmail.com',
        'from', 'aptiskytich <noreply@aptiskytich.vn>',
        'sender_domain', 'notify.aptiskytich.vn',
        'subject', v_subject,
        'html', v_html,
        'text', v_text,
        'purpose', 'transactional',
        'label', 'question_report_notification',
        'idempotency_key', v_message_id,
        'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_on_question_report failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 5) grading_cache INSERT + DELETE policies
CREATE POLICY "Users can insert own grading cache"
ON public.grading_cache FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own grading cache"
ON public.grading_cache FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 6) speaking-recordings storage UPDATE policy
CREATE POLICY "Users can update own speaking recordings"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'speaking-recordings' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'speaking-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 7) Review cache: add content_hash column + composite PK to prevent shared poisoning
ALTER TABLE public.reading_review_cache
  ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '';
ALTER TABLE public.reading_review_cache DROP CONSTRAINT IF EXISTS reading_review_cache_pkey;
ALTER TABLE public.reading_review_cache ADD PRIMARY KEY (exam_set_id, content_hash);

ALTER TABLE public.listening_review_cache
  ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '';
ALTER TABLE public.listening_review_cache DROP CONSTRAINT IF EXISTS listening_review_cache_pkey;
ALTER TABLE public.listening_review_cache ADD PRIMARY KEY (exam_set_id, content_hash);
