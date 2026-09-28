create or replace function public.referral_is_customer(p_user uuid) returns boolean
  language sql stable security definer set search_path to 'public' as $$
    select exists(select 1 from public.payments where user_id = p_user and status = 'paid')
        or exists(select 1 from public.user_subscriptions where user_id = p_user and tier in ('pro','premium'));
  $$;

revoke all on function public.referral_is_customer(uuid) from public, anon;
grant execute on function public.referral_is_customer(uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.referral_rate_for(p_user uuid)
 RETURNS TABLE(referrer_percent integer, discount_percent integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_has_paid boolean;
  v_n int;
begin
  select public.referral_is_customer(p_user) into v_has_paid;
  select count(*) into v_n from public.referral_earnings
    where referrer_user_id = p_user and status <> 'reversed';

  if not v_has_paid then
    referrer_percent := 5; discount_percent := 5;
  else
    discount_percent := 10;
    if v_n < 5 then referrer_percent := 10;
    elsif v_n < 20 then referrer_percent := 12;
    else referrer_percent := 15;
    end if;
  end if;
  return next;
end;
$function$;

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
  v_ref_discount int;
  v_ref_name text;
  v_is_referral boolean := false;
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

  IF v_c.kind = 'referral' THEN
    v_is_referral := true;

    IF v_c.created_by = v_uid THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'own_code',
        'message', 'Đây là mã giới thiệu của bạn, không tự dùng được.');
    END IF;

    IF public.referral_is_customer(v_uid) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_new_user',
        'message', 'Mã giới thiệu chỉ dành cho tài khoản chưa từng mua gói.');
    END IF;

    SELECT r.discount_percent INTO v_ref_discount
      FROM public.referral_rate_for(v_c.created_by) r;
    SELECT display_name INTO v_ref_name FROM public.profiles WHERE user_id = v_c.created_by;
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
    'discount_percent', CASE WHEN v_is_referral THEN v_ref_discount ELSE v_c.discount_percent END,
    'discount_max_vnd', v_c.discount_max_vnd,
    'applies_to_plans', to_jsonb(v_c.applies_to_plans),
    'message', 'Mã hợp lệ. Ưu đãi sẽ được cộng khi bạn hoàn tất thanh toán.')
    || CASE WHEN v_is_referral
         THEN jsonb_build_object('is_referral', true, 'referrer_name', v_ref_name)
         ELSE '{}'::jsonb END;
END;
$function$;