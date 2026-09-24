-- Re-record public.get_my_referral_code exactly as currently running in DB.
-- Only difference from migration 0007: the INSERT INTO public.voucher_codes
-- no longer lists code_norm (generated column = upper(btrim(code)), must not
-- be inserted). Column list starts with (code, kind, discount_percent, ...).

create or replace function public.get_my_referral_code()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.voucher_codes;
  v_code text;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_rp int; v_dp int;
  v_clicks int; v_referred int;
  v_pending bigint; v_available bigint; v_paid bigint;
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

  select coalesce(sum(commission_vnd) filter (where status = 'pending'), 0),
         coalesce(sum(commission_vnd) filter (where status = 'available'), 0),
         coalesce(sum(commission_vnd) filter (where status = 'paid'), 0)
    into v_pending, v_available, v_paid
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
    'paid_vnd', v_paid,
    'next_tier_at', v_next
  );
end;
$$;