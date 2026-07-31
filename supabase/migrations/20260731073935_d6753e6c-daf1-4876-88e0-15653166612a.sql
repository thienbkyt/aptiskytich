CREATE OR REPLACE FUNCTION public.notify_on_payment_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  END;
  RETURN NEW;
END;
$function$;