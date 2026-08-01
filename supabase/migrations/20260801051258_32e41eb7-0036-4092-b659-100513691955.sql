ALTER TABLE public.voucher_codes
  ADD COLUMN IF NOT EXISTS allow_existing_subscribers boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.voucher_codes.allow_existing_subscribers IS
'Mã kind=checkout: cho phép người ĐANG có gói còn hạn (plan_key nằm trong applies_to_plans, hoặc plan_key NULL với khách gói cũ) nhận quà trực tiếp qua redeem_voucher, không cần mua đơn mới. Chống nhận hai lần đã có sẵn nhờ unique (code_id, user_id).';

UPDATE public.voucher_codes SET allow_existing_subscribers = true WHERE code_norm = 'LENGOI7';

CREATE OR REPLACE FUNCTION public.redeem_voucher(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code public.voucher_codes;
  v_used_standalone int;
  v_used_this int;
  v_total_uses int;
  v_tier text;
  v_pro_until timestamptz;
  v_plan_key text;
  v_cap int;
  v_base timestamptz;
  v_new_until timestamptz := NULL;
  v_still_active boolean;
  v_new_cap int;
  v_pro_quota int;
  v_credit_expires timestamptz;
  v_parts text[] := '{}';
  v_message text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Bạn cần đăng nhập để dùng mã.');
  END IF;

  IF public.promo_active() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'promo_active', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Đang trong đợt miễn phí toàn hệ, bạn chưa cần dùng mã. Hãy quay lại sau khi đợt kết thúc.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('redeem_voucher:' || v_uid::text));

  SELECT * INTO v_code FROM public.voucher_codes WHERE code_norm = upper(btrim(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Mã không tồn tại.');
  END IF;

  IF v_code.enabled = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Mã này đã ngừng hoạt động.');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Mã đã hết hạn sử dụng.');
  END IF;

  IF v_code.kind <> 'standalone' THEN
    IF v_code.allow_existing_subscribers IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'checkout_only', 'gift_days', 0, 'gift_ai_credits', 0,
        'message', 'Mã này dùng khi thanh toán — vào trang bảng giá và nhập mã trước khi chọn gói nhé.');
    END IF;

    -- Đang có gói còn hạn thuộc danh sách áp dụng?
    -- plan_key NULL = khách mua trước khi có hệ gói mới → tính là đủ điều kiện.
    SELECT tier, pro_until, plan_key INTO v_tier, v_pro_until, v_plan_key
    FROM public.user_subscriptions WHERE user_id = v_uid;

    IF NOT (
      v_pro_until IS NOT NULL AND v_pro_until > now()
      AND (
        v_plan_key IS NULL
        OR v_code.applies_to_plans IS NULL
        OR v_plan_key = ANY(v_code.applies_to_plans)
      )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'need_eligible_plan', 'gift_days', 0, 'gift_ai_credits', 0,
        'message', 'Mã này dành cho người đang dùng gói từ 1 tháng trở lên. Bạn có thể vào bảng giá mua gói kèm mã để được tặng.');
    END IF;
  END IF;

  SELECT count(*) INTO v_used_standalone
  FROM public.voucher_redemptions
  WHERE user_id = v_uid AND payment_id IS NULL;
  IF v_used_standalone >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'global_limit', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Bạn đã dùng tối đa 3 mã ưu đãi.');
  END IF;

  SELECT count(*) INTO v_used_this
  FROM public.voucher_redemptions
  WHERE user_id = v_uid AND code_id = v_code.id;
  IF v_used_this >= COALESCE(v_code.max_per_user, 1) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Bạn đã dùng mã này rồi.');
  END IF;

  IF v_code.max_total_uses IS NOT NULL THEN
    SELECT count(*) INTO v_total_uses FROM public.voucher_redemptions WHERE code_id = v_code.id;
    IF v_total_uses >= v_code.max_total_uses THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exhausted', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Mã đã hết lượt sử dụng.');
    END IF;
  END IF;

  IF v_code.requires_activity = true AND NOT EXISTS (SELECT 1 FROM public.test_results WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'need_activity', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Bạn cần làm ít nhất một bài trước khi dùng mã này.');
  END IF;

  BEGIN
    SELECT tier, pro_until, ai_daily_cap INTO v_tier, v_pro_until, v_cap
    FROM public.user_subscriptions WHERE user_id = v_uid;

    IF v_code.gift_days > 0 AND COALESCE(v_tier, '') <> 'premium' THEN
      v_base := GREATEST(COALESCE(v_pro_until, now()), now());
      v_new_until := v_base + make_interval(days => v_code.gift_days);
      v_still_active := v_pro_until IS NOT NULL AND v_pro_until > now();

      IF v_code.gift_ai_cap IS NULL THEN
        IF v_cap IS NULL THEN
          SELECT pro_quota INTO v_pro_quota FROM public.feature_flags WHERE key = 'ai_grading_writing';
          v_new_cap := v_pro_quota;
        ELSE
          v_new_cap := v_cap;
        END IF;
      ELSE
        IF v_still_active THEN
          v_new_cap := GREATEST(COALESCE(v_cap, 0), v_code.gift_ai_cap);
        ELSE
          v_new_cap := v_code.gift_ai_cap;
        END IF;
      END IF;

      INSERT INTO public.user_subscriptions (user_id, tier, pro_until, ai_daily_cap, updated_at)
      VALUES (v_uid, 'pro', v_new_until, v_new_cap, now())
      ON CONFLICT (user_id) DO UPDATE
        SET tier = 'pro',
            pro_until = EXCLUDED.pro_until,
            ai_daily_cap = EXCLUDED.ai_daily_cap,
            updated_at = now();
    END IF;

    IF v_code.gift_ai_credits > 0 THEN
      v_credit_expires := COALESCE(v_code.credit_expires_at, v_new_until);
      INSERT INTO public.ai_credit_grants (user_id, amount, source_code_id, expires_at)
      VALUES (v_uid, v_code.gift_ai_credits, v_code.id, v_credit_expires);
    END IF;

    INSERT INTO public.voucher_redemptions (code_id, user_id, payment_id)
    VALUES (v_code.id, v_uid, NULL);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used', 'gift_days', 0, 'gift_ai_credits', 0, 'message', 'Bạn đã dùng mã này rồi.');
  END;

  IF v_code.gift_days > 0 AND COALESCE(v_tier, '') <> 'premium' THEN
    v_parts := v_parts || ('+' || v_code.gift_days || ' ngày sử dụng');
  END IF;
  IF v_code.gift_ai_credits > 0 THEN
    v_parts := v_parts || ('+' || v_code.gift_ai_credits || ' lượt chấm AI');
  END IF;

  IF array_length(v_parts, 1) IS NULL THEN
    v_message := 'Đã nhận mã thành công.';
  ELSE
    v_message := 'Đã nhận: ' || array_to_string(v_parts, ' và ') || '.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'granted',
    'gift_days', v_code.gift_days,
    'gift_ai_credits', v_code.gift_ai_credits,
    'message', v_message
  );
END;
$function$;