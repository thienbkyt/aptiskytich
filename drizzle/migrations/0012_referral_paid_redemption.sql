create or replace function public.referral_on_payment_paid()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

    if exists(select 1 from public.referral_earnings where referred_user_id = NEW.user_id) then
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
    );

    insert into public.voucher_redemptions (code_id, user_id, payment_id)
    values (v_c.id, NEW.user_id, NEW.id)
    on conflict do nothing;

    insert into public.notifications (title, body, type, link_url, is_active, target_user_id)
    values (
      '💸 Bạn vừa nhận hoa hồng giới thiệu',
      'Bạn của bạn vừa mua gói ' || coalesce(NEW.plan_key, '') || '. Hoa hồng '
        || to_char(v_comm, 'FM999G999G999') || 'đ sẽ rút được sau 7 ngày.',
      'referral', '/gioi-thieu', true, v_c.created_by
    );
  exception when others then
    raise warning 'referral_on_payment_paid failed for payment %: %', NEW.id, sqlerrm;
  end;
  return NEW;
end;
$function$;