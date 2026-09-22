create or replace function public.request_referral_payout(
  p_bank_name text, p_bank_account text, p_holder text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_acc text;
  v_amount bigint;
  v_payout uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_logged_in',
      'message', 'Bạn cần đăng nhập.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  v_acc := regexp_replace(coalesce(p_bank_account,''), '\D', '', 'g');
  if v_acc = '' then
    return jsonb_build_object('ok', false, 'reason', 'bad_account',
      'message', 'Bạn chưa nhập số tài khoản hợp lệ.');
  end if;

  if exists (
    select 1 from public.profiles p
     where regexp_replace(coalesce(p.bank_account,''), '\D', '', 'g') = v_acc
       and p.user_id in (select referred_user_id from public.referral_earnings
                          where referrer_user_id = v_uid)
  ) then
    update public.referral_earnings
       set status = 'reversed'
     where referrer_user_id = v_uid
       and status in ('pending','available')
       and referred_user_id in (
         select p.user_id from public.profiles p
          where regexp_replace(coalesce(p.bank_account,''), '\D', '', 'g') = v_acc
       );
    return jsonb_build_object('ok', false, 'reason', 'bank_match',
      'message', 'Số tài khoản trùng với người bạn đã giới thiệu. Hoa hồng liên quan đã bị huỷ.');
  end if;

  select coalesce(sum(commission_vnd), 0) into v_amount
    from public.referral_earnings
   where referrer_user_id = v_uid and status = 'available' and payout_id is null;

  if v_amount < 50000 then
    return jsonb_build_object('ok', false, 'reason', 'below_min',
      'message', 'Cần tối thiểu 50.000đ để rút.');
  end if;

  if exists (select 1 from public.referral_payouts
              where user_id = v_uid and status = 'requested') then
    return jsonb_build_object('ok', false, 'reason', 'pending_request',
      'message', 'Bạn đang có một yêu cầu rút chưa xử lý.');
  end if;

  insert into public.referral_payouts (user_id, amount_vnd, bank_name, bank_account, account_holder, status)
  values (v_uid, v_amount, nullif(btrim(coalesce(p_bank_name,'')),''), v_acc,
          nullif(btrim(coalesce(p_holder,'')),''), 'requested')
  returning id into v_payout;

  update public.referral_earnings
     set payout_id = v_payout
   where referrer_user_id = v_uid and status = 'available' and payout_id is null;

  update public.profiles
     set bank_name = nullif(btrim(coalesce(p_bank_name,'')),''),
         bank_account = v_acc,
         bank_holder = nullif(btrim(coalesce(p_holder,'')),''),
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'amount_vnd', v_amount, 'payout_id', v_payout);
end;
$$;

grant execute on function public.request_referral_payout(text, text, text) to authenticated;
