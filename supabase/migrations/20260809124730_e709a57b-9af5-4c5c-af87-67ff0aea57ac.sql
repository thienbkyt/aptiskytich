ALTER TABLE public.voucher_codes
  ADD COLUMN IF NOT EXISTS discount_percent int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_max_vnd int;

ALTER TABLE public.voucher_codes
  DROP CONSTRAINT IF EXISTS voucher_codes_discount_percent_range;
ALTER TABLE public.voucher_codes
  ADD CONSTRAINT voucher_codes_discount_percent_range
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

CREATE OR REPLACE FUNCTION public.check_voucher(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'discount_percent', v_c.discount_percent,
      'discount_max_vnd', v_c.discount_max_vnd,
      'applies_to_plans', to_jsonb(v_c.applies_to_plans),
      'message', 'Mã này nhận quà ngay, không cần mua gói — vào Dashboard để nhập nhận nhé.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'reason', 'valid', 'kind', v_c.kind,
    'gift_days', v_c.gift_days, 'gift_ai_credits', v_c.gift_ai_credits,
    'discount_percent', v_c.discount_percent,
    'discount_max_vnd', v_c.discount_max_vnd,
    'applies_to_plans', to_jsonb(v_c.applies_to_plans),
    'message', 'Mã hợp lệ. Ưu đãi sẽ được cộng khi bạn hoàn tất thanh toán.');
END;
$function$;

ALTER TABLE public.backup_eq_dauhoi_doc_20260809 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read backup_eq_dauhoi_doc_20260809" ON public.backup_eq_dauhoi_doc_20260809;
CREATE POLICY "Admins can read backup_eq_dauhoi_doc_20260809"
  ON public.backup_eq_dauhoi_doc_20260809
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.backup_eq_dauhoi_doc_20260809 FROM anon;
GRANT SELECT ON public.backup_eq_dauhoi_doc_20260809 TO authenticated;
GRANT ALL ON public.backup_eq_dauhoi_doc_20260809 TO service_role;