-- 1) Bridge function: same signature as the dropped enqueue_email, now POSTs to the
--    managed-email edge function send-app-email via pg_net.
CREATE OR REPLACE FUNCTION public.enqueue_email(p_channel text, p_payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_key text;
  v_to text;
  v_subject text;
  v_html text;
  v_text text;
  v_label text;
  v_msgid text;
  v_idem text;
  v_req_id bigint;
BEGIN
  v_to := lower(btrim(coalesce(p_payload->>'to', '')));
  v_subject := btrim(coalesce(p_payload->>'subject', ''));
  v_html := coalesce(p_payload->>'html', '');
  v_text := coalesce(nullif(btrim(coalesce(p_payload->>'text','')), ''), v_subject);
  v_label := coalesce(nullif(btrim(coalesce(p_payload->>'label','')), ''), 'system');
  v_msgid := nullif(btrim(coalesce(p_payload->>'message_id','')), '');
  v_idem := coalesce(nullif(btrim(coalesce(p_payload->>'idempotency_key','')), ''), v_msgid, gen_random_uuid()::text);

  IF v_to = '' THEN
    RAISE EXCEPTION 'enqueue_email: missing recipient';
  END IF;
  IF v_subject = '' OR v_html = '' THEN
    RAISE EXCEPTION 'enqueue_email: missing subject or html';
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'enqueue_email: service role key not available';
  END IF;

  SELECT net.http_post(
    url := 'https://bacoamhbatqpxatrrflz.supabase.co/functions/v1/send-app-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'to', v_to,
      'subject', v_subject,
      'html', v_html,
      'text', v_text,
      'label', v_label,
      'message_id', v_msgid,
      'idempotency_key', v_idem
    ),
    timeout_milliseconds := 15000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;

-- 2) Keep the swallowing EXCEPTION handlers, but log failures to email_send_log.
CREATE OR REPLACE FUNCTION public.notify_on_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_email text; v_name text;
  v_plan_label text; v_tier text; v_pro_until timestamptz;
  v_han text; v_tien text; v_msgid text;
  v_subject text; v_html text; v_text text;
  v_dur int; v_cur timestamptz; v_expected timestamptz;
BEGIN
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = NEW.user_id;
    v_name := coalesce(nullif(btrim(v_name),''), 'bạn');

    SELECT label INTO v_plan_label FROM public.pricing_plans WHERE key = NEW.plan_key;
    v_plan_label := coalesce(v_plan_label, coalesce(NEW.tier,'Pro'));

    SELECT duration_days INTO v_dur FROM public.pricing_plans WHERE key = NEW.plan_key;
    SELECT tier, pro_until INTO v_tier, v_cur FROM public.user_subscriptions WHERE user_id = NEW.user_id;

    IF v_tier = 'premium' OR v_dur IS NULL THEN
      v_han := 'Trọn đời';
    ELSE
      v_expected := GREATEST(coalesce(v_cur, now()), now()) + make_interval(days => v_dur);
      v_han := 'Đến hết ngày ' || to_char(v_expected AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');
    END IF;

    v_tien := to_char(coalesce(NEW.amount_vnd,0), 'FM999G999G999') || 'đ';

    INSERT INTO public.notifications (title, body, type, is_active, target_user_id)
    VALUES (
      '🎉 Kích hoạt thành công gói ' || v_plan_label,
      'Cảm ơn bạn đã tin tưởng Aptis Kỳ Tích. Gói ' || v_plan_label || ' đã được kích hoạt. Hạn dùng: ' || v_han || '.',
      'payment_success', true, NEW.user_id
    );

    IF v_email IS NOT NULL AND v_email <> '' THEN
      v_msgid := 'payment-paid-' || NEW.id::text;
      v_subject := '🎉 Kích hoạt thành công gói ' || v_plan_label || ' — Aptis Kỳ Tích';
      v_html :=
        '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0F0F10;line-height:1.6">' ||
        '<h2 style="color:#CC1C01;margin:0 0 12px">Cảm ơn bạn đã nâng cấp 🎉</h2>' ||
        '<p>Chào ' || v_name || ', tài khoản của bạn đã được kích hoạt.</p>' ||
        '<table cellpadding="7" cellspacing="0" style="border-collapse:collapse;background:#FFF8F5;border-radius:8px;margin:16px 0">' ||
          '<tr><td><b>Gói</b></td><td>' || v_plan_label || '</td></tr>' ||
          '<tr><td><b>Hạn dùng</b></td><td>' || v_han || '</td></tr>' ||
          '<tr><td><b>Số tiền</b></td><td>' || v_tien || '</td></tr>' ||
          '<tr><td><b>Mã đơn</b></td><td>' || coalesce(NEW.order_code::text,'-') || '</td></tr>' ||
        '</table>' ||
        '<p style="margin:20px 0"><a href="https://aptiskytich.vn/dashboard" style="background:#CC1C01;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Bắt đầu học ngay</a></p>' ||
        '<p style="font-size:14px">Cần hỗ trợ? Nhắn cho đội ngũ qua <a href="https://zalo.me/0867833227">Zalo</a> hoặc <a href="https://www.facebook.com/aptiskytich">Facebook</a>.</p>' ||
        '<p style="color:#6b7280;font-size:13px;margin-top:24px">— Đội ngũ Aptis Kỳ Tích</p></div>';
      v_text := 'Chào ' || v_name || ', gói ' || v_plan_label || ' đã kích hoạt. Hạn dùng: ' || v_han ||
                '. Số tiền: ' || v_tien || '. Mã đơn: ' || coalesce(NEW.order_code::text,'-') ||
                '. Bắt đầu học: https://aptiskytich.vn/dashboard';

      PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
        'message_id', v_msgid, 'to', v_email,
        'from', 'aptiskytich <noreply@aptiskytich.vn>',
        'sender_domain', 'notify.aptiskytich.vn',
        'subject', v_subject, 'html', v_html, 'text', v_text,
        'purpose', 'transactional', 'label', 'payment_success',
        'idempotency_key', v_msgid,
        'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ));
    END IF;

    v_msgid := 'payment-admin-' || NEW.id::text;
    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msgid, 'to', 'aptiskytich.admin@gmail.com',
      'from', 'aptiskytich <noreply@aptiskytich.vn>',
      'sender_domain', 'notify.aptiskytich.vn',
      'subject', '💰 Đơn mới ' || v_tien || ' — ' || v_plan_label,
      'html', '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">' ||
              '<h2 style="color:#CC1C01">💰 Có đơn thanh toán mới</h2><table cellpadding="6" cellspacing="0">' ||
              '<tr><td><b>Người mua</b></td><td>' || coalesce(v_email,'(không rõ)') || ' (' || v_name || ')</td></tr>' ||
              '<tr><td><b>Gói</b></td><td>' || v_plan_label || '</td></tr>' ||
              '<tr><td><b>Hạn dùng</b></td><td>' || v_han || '</td></tr>' ||
              '<tr><td><b>Số tiền</b></td><td>' || v_tien || '</td></tr>' ||
              '<tr><td><b>Mã đơn</b></td><td>' || coalesce(NEW.order_code::text,'-') || '</td></tr>' ||
              '<tr><td><b>Cổng</b></td><td>' || coalesce(NEW.gateway,'-') || '</td></tr>' ||
              '<tr><td><b>Thời gian</b></td><td>' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI') || '</td></tr>' ||
              '</table></div>',
      'text', 'Don moi: ' || coalesce(v_email,'?') || ' | ' || v_plan_label || ' | ' || v_tien,
      'purpose', 'transactional', 'label', 'payment_admin_notification',
      'idempotency_key', v_msgid,
      'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_payment_paid failed: %', SQLERRM;
    BEGIN
      INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status, error_message)
      VALUES (
        'payment-paid-' || NEW.id::text,
        'payment_success',
        coalesce(nullif(v_email,''), 'unknown@aptiskytich.vn'),
        'failed',
        left('notify_on_payment_paid: ' || SQLERRM, 1000)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_on_payment_paid: could not log failure: %', SQLERRM;
    END;
  END;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_question_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_cat text; v_reason text; v_where text; v_rows text := '';
  v_email text; v_device text; v_note text; v_note_html text;
  v_subject text; v_html text; v_text text; v_msgid text;
  fn_row text;
BEGIN
  BEGIN
    v_cat := CASE NEW.report_category
      WHEN 'content' THEN 'Lỗi nội dung'
      WHEN 'functional' THEN 'Lỗi chức năng'
      ELSE coalesce(NEW.report_category, 'Báo lỗi') END;

    v_reason := CASE NEW.reason
      WHEN 'wrong_answer' THEN 'Sai đáp án'
      WHEN 'image' THEN 'Lỗi hình ảnh'
      WHEN 'audio' THEN 'Lỗi audio'
      WHEN 'content' THEN 'Lỗi nội dung'
      WHEN 'cant_nav' THEN 'Không chuyển được câu'
      WHEN 'page_frozen' THEN 'Trang bị đứng/treo'
      WHEN 'button_broken' THEN 'Nút bấm không hoạt động'
      WHEN 'cant_exit' THEN 'Không thoát được'
      WHEN 'other' THEN 'Khác'
      ELSE coalesce(NEW.reason, 'Không rõ') END;

    v_where := btrim(concat_ws(' ', NEW.skill, NEW.part_type,
                 CASE WHEN NEW.question_number IS NOT NULL THEN 'câu ' || NEW.question_number::text END));
    IF v_where = '' THEN v_where := coalesce(nullif(btrim(NEW.section),''), nullif(btrim(NEW.page_url),''), 'Không rõ vị trí'); END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    v_email := coalesce(v_email, 'Ẩn danh (chưa đăng nhập)');

    v_device := CASE NEW.device_type
      WHEN 'mobile' THEN '📱 Điện thoại'
      WHEN 'tablet' THEN '📱 Máy tính bảng'
      WHEN 'desktop' THEN '💻 Máy tính'
      ELSE NULL END;

    v_note := coalesce(nullif(btrim(NEW.note), ''), '(không có ghi chú)');
    v_note_html := replace(replace(replace(replace(replace(v_note,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');
    v_note_html := replace(v_note_html, E'\n', '<br>');

    fn_row := '<tr><td style="padding:5px 10px;color:#6b7280">%L%</td><td style="padding:5px 10px"><b>%V%</b></td></tr>';
    v_rows := v_rows || replace(replace(fn_row,'%L%','Loại lỗi'),'%V%', v_cat || ' · ' || v_reason);
    v_rows := v_rows || replace(replace(fn_row,'%L%','Vị trí'),'%V%', v_where);
    v_rows := v_rows || replace(replace(fn_row,'%L%','Người báo'),'%V%', v_email);
    IF nullif(btrim(NEW.page_url),'') IS NOT NULL THEN
      v_rows := v_rows || replace(replace(fn_row,'%L%','Trang'),'%V%', NEW.page_url);
    END IF;
    IF v_device IS NOT NULL THEN
      v_rows := v_rows || replace(replace(fn_row,'%L%','Thiết bị'),'%V%', v_device);
    END IF;
    v_rows := v_rows || replace(replace(fn_row,'%L%','Ghi chú'),'%V%', v_note_html);
    IF NEW.exam_question_id IS NOT NULL THEN
      v_rows := v_rows || replace(replace(fn_row,'%L%','exam_question_id'),'%V%', NEW.exam_question_id::text);
    END IF;
    v_rows := v_rows || replace(replace(fn_row,'%L%','Thời gian'),'%V%',
                to_char(NEW.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI'));

    v_msgid := 'question-report-' || NEW.id::text;
    v_subject := '🚩 ' || v_cat || ' — ' || v_reason || ' (' || v_where || ')';

    v_html := '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0F0F10;line-height:1.6">' ||
      '<h2 style="color:#CC1C01;margin:0 0 14px">🚩 Báo lỗi mới</h2>' ||
      '<table cellspacing="0" style="border-collapse:collapse;background:#FFF8F5;border-radius:8px">' ||
      v_rows || '</table>' ||
      '<p style="margin-top:18px">👉 Vào <a href="https://aptiskytich.vn/admin/reports">/admin/reports</a> để xem và xử lý.</p></div>';

    v_text := v_cat || ' - ' || v_reason || ' | Vi tri: ' || v_where || ' | Nguoi bao: ' || v_email ||
              ' | Ghi chu: ' || v_note || ' | https://aptiskytich.vn/admin/reports';

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msgid, 'to', 'khanhthien4698@gmail.com',
      'from', 'aptiskytich <noreply@aptiskytich.vn>',
      'sender_domain', 'notify.aptiskytich.vn',
      'subject', v_subject, 'html', v_html, 'text', v_text,
      'purpose', 'transactional', 'label', 'question_report_notification',
      'idempotency_key', v_msgid,
      'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_on_question_report failed: %', SQLERRM;
    BEGIN
      INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status, error_message)
      VALUES (
        'question-report-' || NEW.id::text,
        'question_report_notification',
        'khanhthien4698@gmail.com',
        'failed',
        left('notify_admin_on_question_report: ' || SQLERRM, 1000)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_admin_on_question_report: could not log failure: %', SQLERRM;
    END;
  END;
  RETURN NEW;
END;
$fn$;