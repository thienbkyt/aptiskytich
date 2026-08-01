CREATE OR REPLACE FUNCTION public.voucher_campaign_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_campaign boolean := false;
  v_granted bigint := 0;
  v_used bigint := 0;
  v_balance bigint := 0;
  v_expire timestamptz;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.voucher_codes vc
    WHERE vc.enabled = true
      AND (vc.expires_at IS NULL OR vc.expires_at > now())
  ) INTO v_has_campaign;

  IF v_uid IS NOT NULL THEN
    SELECT COALESCE(SUM(g.amount), 0), MIN(g.expires_at)
      INTO v_granted, v_expire
    FROM public.ai_credit_grants g
    WHERE g.user_id = v_uid
      AND (g.expires_at IS NULL OR g.expires_at > now());

    SELECT COUNT(DISTINCT COALESCE(fu.ref_id, fu.id::text))
      INTO v_used
    FROM public.feature_usage fu
    WHERE fu.user_id = v_uid
      AND fu.paid_by_credit = true;

    v_balance := GREATEST(0, v_granted - v_used);
  END IF;

  RETURN jsonb_build_object(
    'has_campaign', v_has_campaign,
    'credits_balance', v_balance,
    'credits_expire_at', v_expire
  );
END;
$$;

REVOKE ALL ON FUNCTION public.voucher_campaign_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voucher_campaign_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_voucher(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_norm text := upper(btrim(coalesce(p_code, '')));
  v_c public.voucher_codes;
  v_total_uses int;
  v_my_uses int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_logged_in',
      'message', 'Bạn cần đăng nhập để dùng mã ưu đãi.');
  END IF;

  IF v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty',
      'message', 'Bạn chưa nhập mã.');
  END IF;

  SELECT * INTO v_c FROM public.voucher_codes
  WHERE code_norm = v_norm OR upper(btrim(code)) = v_norm
  LIMIT 1;

  IF v_c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found',
      'message', 'Mã không tồn tại. Bạn kiểm tra lại giúp mình nhé.');
  END IF;

  IF v_c.enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled',
      'message', 'Mã này đã ngừng áp dụng.');
  END IF;

  IF v_c.expires_at IS NOT NULL AND v_c.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired',
      'message', 'Mã đã hết hạn.',
      'expires_at', v_c.expires_at);
  END IF;

  SELECT COUNT(*) INTO v_total_uses FROM public.voucher_redemptions WHERE code_id = v_c.id;
  IF v_c.max_total_uses IS NOT NULL AND v_total_uses >= v_c.max_total_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exhausted',
      'message', 'Mã đã hết lượt sử dụng.');
  END IF;

  SELECT COUNT(*) INTO v_my_uses FROM public.voucher_redemptions
  WHERE code_id = v_c.id AND user_id = v_uid;
  IF v_my_uses >= COALESCE(v_c.max_per_user, 1) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used',
      'message', 'Bạn đã dùng mã này rồi.');
  END IF;

  IF v_c.kind = 'standalone' THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'standalone', 'kind', v_c.kind,
      'gift_days', v_c.gift_days, 'gift_ai_credits', v_c.gift_ai_credits,
      'applies_to_plans', to_jsonb(v_c.applies_to_plans),
      'message', 'Mã này nhận quà ngay, không cần mua gói — vào Dashboard để nhập nhận nhé.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'reason', 'valid', 'kind', v_c.kind,
    'gift_days', v_c.gift_days, 'gift_ai_credits', v_c.gift_ai_credits,
    'applies_to_plans', to_jsonb(v_c.applies_to_plans),
    'message', 'Mã hợp lệ. Ưu đãi sẽ được cộng khi bạn hoàn tất thanh toán.');
END;
$$;

REVOKE ALL ON FUNCTION public.check_voucher(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_voucher(text) TO authenticated;