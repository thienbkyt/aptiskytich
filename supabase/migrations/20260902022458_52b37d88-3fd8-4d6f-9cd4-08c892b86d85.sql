CREATE OR REPLACE FUNCTION public.send_subscription_reminder_emails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record; v_since timestamptz; v_sent int := 0;
  v_email text; v_name text; v_msgid text; v_label text; v_han text;
  v_subject text; v_html text; v_url text;
  v_promo_head text; v_promo_tail text;
BEGIN
  SELECT coalesce(payment_emails_since, now()) INTO v_since FROM public.email_send_state WHERE id = 1;

  -- Noi dung uu dai dung chung cho khoi 'expired' va 'payment_pending_reminder_d1'
  v_promo_head :=
    '<p>Chào bạn,</p>' ||
    '<p>Trước tiên, <b>cảm ơn bạn rất nhiều vì đã ủng hộ và đồng hành cùng Aptis Kỳ Tích trong thời gian vừa qua.</b></p>' ||
    '<p>Tụi mình biết để có thể xây dựng và hoàn thiện Kỳ Tích như hiện tại, mỗi lượt sử dụng, mỗi feedback và sự ủng hộ của mọi người đều rất quý với team.</p>';

  v_promo_tail :=
    '<p><b>Với gói 1 tháng, 3 tháng và 6 tháng:</b></p>' ||
    '<p>Nhập mã: <b style="font-size:19px">KYTICH150</b> → Giảm <b>15%</b></p>' ||
    '<p><b>Với gói 1 ngày và 1 tuần:</b></p>' ||
    '<p>Nhập mã: <b style="font-size:19px">KYTICH101</b> → Giảm <b>10%</b></p>' ||
    '<p>Bạn chỉ cần đăng nhập Aptis Kỳ Tích, chọn gói muốn đăng ký và nhập mã khi thanh toán. Truy cập <a href="https://aptiskytich.vn/pricing">aptiskytich.vn/pricing</a> để áp mã ngay khi thanh toán nha.</p>' ||
    '<p>Nếu gặp bất kỳ vấn đề gì khi nhập mã hoặc thanh toán, bạn cứ nhắn Admin để tụi mình hỗ trợ nhé.</p>' ||
    '<p>Một lần nữa, <b>cảm ơn bạn vì đã lựa chọn Aptis Kỳ Tích.</b> Hy vọng Kỳ Tích sẽ tiếp tục là một phần nhỏ giúp bạn trên hành trình đạt AIM. ❤️</p>' ||
    '<p><b>Thân mến,</b></p>' ||
    '<p><b>Đội ngũ Aptis Kỳ Tích</b></p>';

  ---------- 1) Nhac don do dang: pending > 15 phut, moi nguoi 1 mail ----------
  FOR r IN
    SELECT DISTINCT ON (p.user_id) p.id, p.user_id, p.plan_key, p.checkout_url
    FROM public.payments p
    WHERE p.status = 'pending'
      AND p.created_at <= now() - interval '15 minutes'
      AND p.created_at >= v_since
      AND p.created_at > now() - interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM public.payments p2
                      WHERE p2.user_id = p.user_id AND p2.status = 'paid'
                        AND p2.created_at >= p.created_at)
    ORDER BY p.user_id, p.created_at DESC
  LOOP
    v_msgid := 'payment-pending-' || r.id::text;
    IF EXISTS (SELECT 1 FROM public.email_send_log WHERE message_id = v_msgid) THEN CONTINUE; END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = r.user_id;
    CONTINUE WHEN v_email IS NULL OR v_email = '';
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = r.user_id;
    v_name := coalesce(nullif(btrim(v_name),''), 'bạn');
    SELECT label INTO v_label FROM public.pricing_plans WHERE key = r.plan_key;
    v_label := coalesce(v_label, 'nâng cấp');
    v_url := coalesce(nullif(btrim(r.checkout_url),''), 'https://aptiskytich.vn/pricing');

    v_html := '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F0F10">' ||
      '<h2 style="color:#CC1C01;margin:0 0 12px">Chỉ còn 1 bước nữa thôi</h2>' ||
      '<p>Chào ' || v_name || ', bạn đã chọn gói <b>' || v_label || '</b> nhưng chưa hoàn tất thanh toán.</p>' ||
      '<p>Hoàn tất ngay để mở toàn bộ kho đề và chấm AI không giới hạn.</p>' ||
      '<p style="margin:20px 0"><a href="' || v_url || '" style="background:#CC1C01;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Hoàn tất thanh toán</a></p>' ||
      '<p style="color:#6b7280;font-size:13px">Nếu bạn đã thanh toán rồi, bỏ qua email này nhé.</p></div>';

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msgid, 'to', v_email,
      'from', 'aptiskytich <noreply@aptiskytich.vn>', 'sender_domain', 'notify.aptiskytich.vn',
      'subject', 'Chỉ còn 1 bước nữa để mở gói ' || v_label,
      'html', v_html, 'text', 'Ban da chon goi ' || v_label || ' nhung chua hoan tat thanh toan: ' || v_url,
      'purpose', 'transactional', 'label', 'payment_pending_reminder',
      'idempotency_key', v_msgid,
      'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    v_sent := v_sent + 1;
  END LOOP;

  ---------- 1b) Nhac don do dang lan hai: sau 24-48 gio, kem ma uu dai ----------
  FOR r IN
    SELECT DISTINCT ON (p.user_id) p.id, p.user_id, p.plan_key
    FROM public.payments p
    WHERE p.status = 'pending'
      AND p.created_at <= now() - interval '24 hours'
      AND p.created_at > now() - interval '48 hours'
      AND p.created_at >= v_since
      AND NOT EXISTS (SELECT 1 FROM public.payments p2
                      WHERE p2.user_id = p.user_id AND p2.status = 'paid'
                        AND p2.created_at >= p.created_at)
      AND EXISTS (SELECT 1 FROM public.email_send_log l
                  WHERE l.message_id = 'payment-pending-' || p.id::text)
    ORDER BY p.user_id, p.created_at DESC
  LOOP
    v_msgid := 'payment-pending-d1-' || r.id::text;
    IF EXISTS (SELECT 1 FROM public.email_send_log WHERE message_id = v_msgid) THEN CONTINUE; END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = r.user_id;
    CONTINUE WHEN v_email IS NULL OR v_email = '';

    v_subject := 'Ưu đãi riêng cho bạn — hoàn tất đăng ký Aptis Kỳ Tích';
    v_html := '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F0F10">' ||
      '<h2 style="color:#CC1C01;margin:0 0 12px">Ưu đãi riêng cho bạn</h2>' ||
      v_promo_head ||
      '<p>Ad thấy bạn đã chọn gói nhưng chưa hoàn tất thanh toán, nên muốn gửi riêng bạn một <b>ưu đãi nhỏ</b> để bắt đầu ôn luyện cùng Kỳ Tích:</p>' ||
      v_promo_tail ||
      '<p style="margin:20px 0"><a href="https://aptiskytich.vn/pricing" style="background:#CC1C01;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Chọn gói và nhập mã</a></p>' ||
      '</div>';

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msgid, 'to', v_email,
      'from', 'aptiskytich <noreply@aptiskytich.vn>', 'sender_domain', 'notify.aptiskytich.vn',
      'subject', v_subject, 'html', v_html,
      'text', 'Uu dai rieng cho ban: nhap ma KYTICH150 giam 15% (goi 1-3-6 thang) hoac KYTICH101 giam 10% (goi 1 ngay, 1 tuan) tai https://aptiskytich.vn/pricing',
      'purpose', 'transactional', 'label', 'payment_pending_reminder_d1',
      'idempotency_key', v_msgid,
      'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    v_sent := v_sent + 1;
  END LOOP;

  ---------- 2) Sap het han (1 ngay) va da het han ----------
  FOR r IN
    SELECT s.user_id, s.pro_until,
      CASE
        WHEN s.pro_until::date = (now() + interval '1 day')::date  THEN '1d'
        WHEN s.pro_until < now() AND s.pro_until >= greatest(v_since, now() - interval '2 days') THEN 'expired'
      END AS kind
    FROM public.user_subscriptions s
    WHERE s.pro_until IS NOT NULL
      AND coalesce(s.tier,'pro') <> 'premium'
  LOOP
    CONTINUE WHEN r.kind IS NULL;
    v_msgid := 'sub-' || r.kind || '-' || r.user_id::text || '-' || to_char(r.pro_until,'YYYYMMDD');
    IF EXISTS (SELECT 1 FROM public.email_send_log WHERE message_id = v_msgid) THEN CONTINUE; END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = r.user_id;
    CONTINUE WHEN v_email IS NULL OR v_email = '';
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = r.user_id;
    v_name := coalesce(nullif(btrim(v_name),''), 'bạn');
    v_han := to_char(r.pro_until AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');

    IF r.kind = 'expired' THEN
      v_subject := 'Gói Pro của bạn đã hết hạn — gia hạn để học tiếp';
      v_html := '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F0F10">' ||
        '<h2 style="color:#CC1C01;margin:0 0 12px">Gói Pro đã hết hạn</h2>' ||
        v_promo_head ||
        '<p>Vì vậy, khi gói ôn luyện của bạn đã hết hạn, Ad muốn gửi riêng bạn một <b>ưu đãi nhỏ để tiếp tục đồng hành cùng Kỳ Tích</b>:</p>' ||
        v_promo_tail;
    ELSE
      v_subject := 'Gói Pro của bạn hết hạn vào ngày mai';
      v_html := '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F0F10">' ||
        '<h2 style="color:#CC1C01;margin:0 0 12px">Sắp đến hạn gia hạn</h2>' ||
        '<p>Chào ' || v_name || ', gói Pro của bạn có hạn đến hết ngày <b>' || v_han || '</b>.</p>' ||
        '<p>Gia hạn sớm để việc ôn luyện không bị gián đoạn.</p>';
    END IF;

    v_html := v_html ||
      '<p style="margin:20px 0"><a href="https://aptiskytich.vn/pricing" style="background:#CC1C01;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Gia hạn ngay</a></p>' ||
      '<p style="color:#6b7280;font-size:13px;margin-top:20px">— Đội ngũ Aptis Kỳ Tích</p></div>';

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msgid, 'to', v_email,
      'from', 'aptiskytich <noreply@aptiskytich.vn>', 'sender_domain', 'notify.aptiskytich.vn',
      'subject', v_subject, 'html', v_html,
      'text', v_subject || ' — gia han tai https://aptiskytich.vn/pricing',
      'purpose', 'transactional', 'label', 'subscription_' || r.kind,
      'idempotency_key', v_msgid,
      'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$function$;