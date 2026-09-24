-- Re-record live definitions (pg_get_functiondef)

CREATE OR REPLACE FUNCTION public.admin_mark_referral_payout(p_payout_id uuid, p_status text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p public.referral_payouts;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  if p_status not in ('paid','rejected') then
    raise exception 'invalid status';
  end if;

  select * into v_p from public.referral_payouts where id = p_payout_id;
  if v_p.id is null then raise exception 'payout not found'; end if;
  if v_p.status <> 'requested' then raise exception 'payout already handled'; end if;

  if p_status = 'paid' then
    update public.referral_payouts
       set status = 'paid', paid_at = now(), paid_by = auth.uid(), admin_note = p_note
     where id = p_payout_id;
    update public.referral_earnings set status = 'paid' where payout_id = p_payout_id;
    insert into public.notifications (title, body, type, link_url, is_active, target_user_id)
    values (
      '✅ Đã chuyển hoa hồng ' || replace(to_char(v_p.amount_vnd, 'FM999G999G999'), ',', '.') || 'đ',
      'Hoa hồng giới thiệu của bạn đã được chuyển vào ' || coalesce(v_p.bank_name, 'tài khoản') || ' ' || coalesce(v_p.bank_account, '') || '. Bạn kiểm tra nhé.',
      'referral', '/gioi-thieu', true, v_p.user_id
    );
  else
    update public.referral_payouts
       set status = 'rejected', admin_note = p_note
     where id = p_payout_id;
    update public.referral_earnings set payout_id = null where payout_id = p_payout_id;
    insert into public.notifications (title, body, type, link_url, is_active, target_user_id)
    values (
      'Yêu cầu rút hoa hồng chưa được duyệt',
      coalesce(nullif(p_note, ''), 'Admin cần kiểm tra thêm.') || ' Số dư vẫn còn nguyên, bạn có thể gửi lại yêu cầu.',
      'referral', '/gioi-thieu', true, v_p.user_id
    );
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_referral_code()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_c public.voucher_codes;
  v_code text;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rp int; v_dp int;
  v_clicks int; v_referred int;
  v_pending bigint; v_available bigint; v_requested bigint; v_paid bigint;
  v_next int;
  i int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_logged_in');
  end if;

  select * into v_c from public.voucher_codes
   where kind = 'referral' and created_by = v_uid limit 1;

  if v_c.id is null then
    loop
      v_code := 'KT-';
      for i in 1..5 loop
        v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
      end loop;
      exit when not exists(select 1 from public.voucher_codes where code_norm = v_code);
    end loop;

    insert into public.voucher_codes (
      code, kind, discount_percent, applies_to_plans,
      max_per_user, max_total_uses, allow_existing_subscribers,
      requires_activity, enabled, expires_at, created_by, note
    ) values (
      v_code, 'referral', 10, array['week','month','quarter','half_year'],
      1, null, false, false, true, null, v_uid, 'referral'
    ) returning * into v_c;
  end if;

  select r.referrer_percent, r.discount_percent into v_rp, v_dp
    from public.referral_rate_for(v_uid) r;

  select count(*) into v_clicks from public.referral_clicks where code_id = v_c.id;
  select count(*) into v_referred from public.referral_earnings
    where referrer_user_id = v_uid and status <> 'reversed';

  -- available = rút được và CHƯA nằm trong yêu cầu rút nào; requested = đang chờ admin chuyển
  select coalesce(sum(commission_vnd) filter (where status = 'pending'), 0),
         coalesce(sum(commission_vnd) filter (where status = 'available' and payout_id is null), 0),
         coalesce(sum(commission_vnd) filter (where status = 'available' and payout_id is not null), 0),
         coalesce(sum(commission_vnd) filter (where status = 'paid'), 0)
    into v_pending, v_available, v_requested, v_paid
    from public.referral_earnings where referrer_user_id = v_uid;

  if v_referred < 5 then v_next := 5;
  elsif v_referred < 20 then v_next := 20;
  else v_next := null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_c.code,
    'referrer_percent', v_rp,
    'discount_percent', v_dp,
    'clicks', v_clicks,
    'referred_count', v_referred,
    'pending_vnd', v_pending,
    'available_vnd', v_available,
    'requested_vnd', v_requested,
    'paid_vnd', v_paid,
    'next_tier_at', v_next
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.referral_on_payment_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c public.voucher_codes;
  v_pct int;
  v_amount int;
  v_comm int;
begin
  begin
    if NEW.voucher_code is null then return NEW; end if;

    select * into v_c from public.voucher_codes
     where code_norm = upper(btrim(NEW.voucher_code)) and kind = 'referral' limit 1;
    if v_c.id is null then return NEW; end if;
    if v_c.created_by is null or v_c.created_by = NEW.user_id then return NEW; end if;
    if NEW.plan_key = 'day' then return NEW; end if;

    -- một lần / B: dòng reversed (đơn từng bị huỷ) không tính là đã nhận
    if exists(select 1 from public.referral_earnings
               where referred_user_id = NEW.user_id and status <> 'reversed' and payment_id <> NEW.id) then
      return NEW;
    end if;
    if exists(select 1 from public.payments
               where user_id = NEW.user_id and status = 'paid' and id <> NEW.id) then
      return NEW;
    end if;

    select r.referrer_percent into v_pct from public.referral_rate_for(v_c.created_by) r;
    v_amount := coalesce(NEW.amount_vnd, 0);
    v_comm := round(v_amount * v_pct / 100.0);

    insert into public.referral_earnings (
      referrer_user_id, referred_user_id, payment_id, code_id, plan_key,
      order_amount_vnd, commission_percent, commission_vnd, status, available_at
    ) values (
      v_c.created_by, NEW.user_id, NEW.id, v_c.id, NEW.plan_key,
      v_amount, v_pct, v_comm, 'pending', coalesce(NEW.paid_at, now()) + interval '7 days'
    )
    on conflict (payment_id) do update
      set status = 'pending', payout_id = null,
          available_at = coalesce(NEW.paid_at, now()) + interval '7 days';

    insert into public.voucher_redemptions (code_id, user_id, payment_id)
    values (v_c.id, NEW.user_id, NEW.id)
    on conflict do nothing;

    insert into public.notifications (title, body, type, link_url, is_active, target_user_id)
    values (
      '💸 Bạn vừa nhận hoa hồng giới thiệu',
      'Bạn của bạn vừa mua gói ' || coalesce((select label from public.pricing_plans where key = NEW.plan_key), NEW.plan_key, '')
        || '. Hoa hồng ' || replace(to_char(v_comm, 'FM999G999G999'), ',', '.') || 'đ sẽ rút được sau 7 ngày.',
      'referral', '/gioi-thieu', true, v_c.created_by
    );
  exception when others then
    raise warning 'referral_on_payment_paid failed for payment %: %', NEW.id, sqlerrm;
  end;
  return NEW;
end;
$function$
;
