-- lovable-cron-fallback-reviewed: 96 runs/day; per-hour provider send cap requires small batches every 15 minutes so nurture mail is spread out without blocking transactional mail
CREATE OR REPLACE FUNCTION public.send_signup_nurture_emails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record; v_sent int := 0; v_cap int := 15;
  v_email text; v_name text; v_msgid text; v_subject text; v_html text; v_text text;
  v_band text; v_open text; v_btn text; v_url text; v_mo_dau text;
  v_tips text; v_tail text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.email_send_log l
    WHERE l.created_at >= now() - interval '15 minutes'
      AND l.status = 'failed'
      AND (l.error_message ILIKE '%429%' OR l.error_message ILIKE '%rate_limited%')
  ) THEN
    RETURN 0;
  END IF;

  IF (SELECT count(*) FROM public.email_send_log l
      WHERE l.created_at >= now() - interval '60 minutes'
        AND l.status = 'sent') >= 70 THEN
    RETURN 0;
  END IF;

  v_tips :=
    '<p>Sau khi có band, tụi mình gợi ý 3 việc:</p>' ||
    '<ul>' ||
    '<li>Đề thi thật mấy tuần gần đây được tổng hợp ở mục <b>Key Dự Đoán</b>, cập nhật mỗi ngày.</li>' ||
    '<li>Speaking và Writing được <b>AI chấm chi tiết kèm bài viết lại</b> — tài khoản free có 3 lượt thử.</li>' ||
    '<li>Làm sai câu nào, web tự gom vào <b>Ôn câu sai</b> để bạn làm lại.</li>' ||
    '</ul>';
  v_tail :=
    '<p>Có gì thắc mắc cứ nhắn Admin qua nút chat góc phải màn hình nhé.</p>' ||
    '<p><b>Thân mến,</b></p><p><b>Đội ngũ Aptis Kỳ Tích</b></p></div>';

  FOR r IN
    SELECT u.id AS user_id, u.email, u.created_at
    FROM auth.users u
    WHERE u.email IS NOT NULL AND btrim(u.email) <> ''
      AND u.created_at >= '2026-09-01'
      AND u.created_at >= '2026-09-15'
      AND u.created_at <= now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = u.id AND p.status = 'paid')
      AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE s.email = lower(u.email))
      AND NOT EXISTS (SELECT 1 FROM public.email_unsubscribe_tokens t
                      WHERE t.email = lower(u.email) AND t.used_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.email_send_log l
                      WHERE l.message_id = 'nurture-d1-' || u.id::text
                        AND l.status IN ('sent','suppressed','bounced'))
    ORDER BY u.created_at ASC
    LIMIT v_cap
  LOOP
    EXIT WHEN v_sent >= v_cap;
    v_msgid := 'nurture-d1-' || r.user_id::text;
    v_email := lower(btrim(r.email));
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = r.user_id;
    v_name := coalesce(nullif(btrim(v_name),''), 'bạn');

    IF EXISTS (SELECT 1 FROM public.test_results tr WHERE tr.user_id = r.user_id) THEN
      SELECT nullif(btrim(coalesce(tr.level,'')),'') INTO v_band
      FROM public.test_results tr
      WHERE tr.user_id = r.user_id AND nullif(btrim(coalesce(tr.level,'')),'') IS NOT NULL
      ORDER BY tr.created_at DESC LIMIT 1;
      v_open := '<p>Bạn đã làm bài trên Kỳ Tích rồi' ||
        coalesce(' và đang ở band ' || v_band, '') ||
        '. Kết quả từng phần nằm trong Lịch sử học tập — vào xem phần nào đang kéo điểm xuống nhé.</p>';
      v_btn := 'Xem kết quả';
      v_url := 'https://aptiskytich.vn/history';
    ELSE
      v_band := NULL;
      v_open := '<p>Bạn đã có tài khoản Aptis Kỳ Tích rồi nhưng tụi mình thấy bạn chưa làm bài nào. ' ||
        'Việc đầu tiên nên làm là <b>thi thử miễn phí</b> — 1 đề đủ 4 kỹ năng, chấm ngay, ra band từng phần. ' ||
        'Biết mình đang ở đâu rồi mới biết cần luyện gì.</p>';
      v_btn := 'Thi thử ngay';
      v_url := 'https://aptiskytich.vn/thi-thu';
    END IF;

    v_subject := v_name || ' ơi, thi thử Aptis miễn phí ở đây — 30 phút biết ngay band';
    v_html := '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F0F10">' ||
      '<h2 style="color:#CC1C01;margin:0 0 12px">Thi thử miễn phí trước đã</h2>' ||
      '<p>Chào ' || v_name || ',</p>' || v_open ||
      '<p style="margin:20px 0"><a href="' || v_url || '" style="background:#CC1C01;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">' || v_btn || '</a></p>' ||
      v_tips || v_tail;
    v_text := 'Chao ' || v_name || ', ' || v_btn || ': ' || v_url ||
      '. Key Du Doan cap nhat moi ngay, AI cham Speaking/Writing (3 luot free), On cau sai tu dong.';

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msgid, 'to', v_email,
      'from', 'aptiskytich <noreply@aptiskytich.vn>', 'sender_domain', 'notify.aptiskytich.vn',
      'subject', v_subject, 'html', v_html, 'text', v_text,
      'purpose', 'transactional', 'label', 'signup_nurture_d1',
      'idempotency_key', v_msgid,
      'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    v_sent := v_sent + 1;
    PERFORM pg_sleep(0.3);
  END LOOP;

  IF v_sent < v_cap THEN
  FOR r IN
    SELECT u.id AS user_id, u.email, u.created_at
    FROM auth.users u
    WHERE u.email IS NOT NULL AND btrim(u.email) <> ''
      AND u.created_at >= '2026-09-01'
      AND u.created_at <= now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = u.id AND p.status = 'paid')
      AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE s.email = lower(u.email))
      AND NOT EXISTS (SELECT 1 FROM public.email_unsubscribe_tokens t
                      WHERE t.email = lower(u.email) AND t.used_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.email_send_log l
                      WHERE l.message_id = 'nurture-d2-' || u.id::text
                        AND l.status IN ('sent','suppressed','bounced'))
    ORDER BY u.created_at ASC
    LIMIT v_cap
  LOOP
    EXIT WHEN v_sent >= v_cap;
    v_msgid := 'nurture-d2-' || r.user_id::text;
    v_email := lower(btrim(r.email));
    SELECT display_name INTO v_name FROM public.profiles WHERE user_id = r.user_id;
    v_name := coalesce(nullif(btrim(v_name),''), 'bạn');
    v_mo_dau := CASE WHEN r.created_at >= '2026-09-15'
      THEN 'Bạn vừa tạo tài khoản Aptis Kỳ Tích hai hôm trước.'
      ELSE 'Bạn đã tạo tài khoản Aptis Kỳ Tích.' END;

    v_subject := 'Kỳ Tích dành riêng cho ' || v_name || ' một mã giảm giá';
    v_html := '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0F0F10">' ||
      '<h2 style="color:#CC1C01;margin:0 0 12px">Kỳ Tích dành riêng cho bạn một mã giảm giá</h2>' ||
      '<p>Chào ' || v_name || ',</p>' ||
      '<p>' || v_mo_dau || ' Tụi mình biết bước khó nhất khi ôn Aptis không phải là học, mà là chọn được đúng thứ để học trong lúc ngày thi cứ gần dần.</p>' ||
      '<p>Vì vậy Kỳ Tích dành riêng cho bạn một mã giảm giá cho lần đăng ký đầu tiên:</p>' ||
      '<p>Nhập mã: <b style="font-size:19px">KYTICH150</b> → giảm <b>15%</b> gói 1 tháng, 3 tháng, 6 tháng</p>' ||
      '<p>Nhập mã: <b style="font-size:19px">KYTICH101</b> → giảm <b>10%</b> gói 1 ngày, 1 tuần</p>' ||
      '<p>Với gói Pro bạn có ngay <b>Key Dự Đoán</b> cập nhật mỗi ngày, toàn bộ kho đề 4 kỹ năng, và AI chấm chữa bài Speaking/Writing kèm bài viết lại mẫu. Gói 1 ngày chỉ <b>25.000đ</b> — đủ để xem key và làm hết đề key trên web.</p>' ||
      '<p style="margin:20px 0"><a href="https://aptiskytich.vn/pricing" style="background:#CC1C01;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Nhận ưu đãi</a></p>' ||
      '<p>Bạn chỉ cần chọn gói, nhập mã ở bước thanh toán. Có trục trặc gì cứ nhắn Admin, tụi mình hỗ trợ ngay.</p>' ||
      '<p><b>Thân mến,</b></p><p><b>Đội ngũ Aptis Kỳ Tích</b></p></div>';
    v_text := 'Chao ' || v_name || ', nhap ma KYTICH150 giam 15% (goi 1-3-6 thang) hoac KYTICH101 giam 10% (goi 1 ngay, 1 tuan) tai https://aptiskytich.vn/pricing. Goi 1 ngay chi 25.000d.';

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msgid, 'to', v_email,
      'from', 'aptiskytich <noreply@aptiskytich.vn>', 'sender_domain', 'notify.aptiskytich.vn',
      'subject', v_subject, 'html', v_html, 'text', v_text,
      'purpose', 'transactional', 'label', 'signup_nurture_d2',
      'idempotency_key', v_msgid,
      'queued_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
    v_sent := v_sent + 1;
    PERFORM pg_sleep(0.3);
  END LOOP;
  END IF;

  RETURN v_sent;
END;
$function$;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE command ILIKE '%send_signup_nurture_emails%' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
  PERFORM cron.schedule('signup-nurture-emails', '*/15 * * * *', 'select public.send_signup_nurture_emails();');
END $$;