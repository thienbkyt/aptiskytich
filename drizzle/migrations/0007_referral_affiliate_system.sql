-- 1. Helper: dynamic referral rates
create or replace function public.referral_rate_for(p_user uuid)
returns table(referrer_percent int, discount_percent int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_has_paid boolean;
  v_n int;
begin
  select exists(select 1 from public.payments where user_id = p_user and status = 'paid') into v_has_paid;
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
$$;

-- 3. Tables
create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  code_id uuid references public.voucher_codes(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  user_agent text
);
create index if not exists referral_clicks_code_idx on public.referral_clicks(code_id);
grant all on public.referral_clicks to service_role;
alter table public.referral_clicks enable row level security;

create table if not exists public.referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null,
  referred_user_id uuid not null,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  code_id uuid references public.voucher_codes(id) on delete set null,
  plan_key text,
  order_amount_vnd int not null,
  commission_percent int not null,
  commission_vnd int not null,
  status text not null default 'pending' check (status in ('pending','available','paid','reversed')),
  available_at timestamptz not null,
  payout_id uuid null,
  created_at timestamptz not null default now()
);
create index if not exists referral_earnings_referrer_status_idx
  on public.referral_earnings(referrer_user_id, status);
grant select on public.referral_earnings to authenticated;
grant all on public.referral_earnings to service_role;
alter table public.referral_earnings enable row level security;

create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_vnd int not null,
  bank_name text,
  bank_account text,
  account_holder text,
  status text not null default 'requested' check (status in ('requested','paid','rejected')),
  admin_note text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid
);
create index if not exists referral_payouts_user_status_idx on public.referral_payouts(user_id, status);
grant select on public.referral_payouts to authenticated;
grant all on public.referral_payouts to service_role;
alter table public.referral_payouts enable row level security;

-- RLS policies
drop policy if exists "referral_clicks admin read" on public.referral_clicks;
create policy "referral_clicks admin read" on public.referral_clicks
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "referral_earnings own read" on public.referral_earnings;
create policy "referral_earnings own read" on public.referral_earnings
  for select to authenticated
  using (auth.uid() = referrer_user_id or public.has_role(auth.uid(), 'admin'));
drop policy if exists "referral_earnings admin update" on public.referral_earnings;
create policy "referral_earnings admin update" on public.referral_earnings
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "referral_payouts own read" on public.referral_payouts;
create policy "referral_payouts own read" on public.referral_payouts
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
drop policy if exists "referral_payouts admin update" on public.referral_payouts;
create policy "referral_payouts admin update" on public.referral_payouts
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Bank info on profiles
alter table public.profiles
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists bank_holder text;

-- 2. Referral code RPC
create or replace function public.get_my_referral_code()
returns jsonb
language plpgsql
security definer
set search_path = public
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
      code, code_norm, kind, discount_percent, applies_to_plans,
      max_per_user, max_total_uses, allow_existing_subscribers,
      requires_activity, enabled, expires_at, created_by, note
    ) values (
      v_code, v_code, 'referral', 10, array['week','month','quarter','half_year'],
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

create or replace function public.log_referral_click(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from public.voucher_codes
   where kind = 'referral'
     and (code_norm = upper(btrim(coalesce(p_code,''))) or upper(btrim(code)) = upper(btrim(coalesce(p_code,''))))
   limit 1;
  if v_id is null then return; end if;
  insert into public.referral_clicks (code_id, user_agent)
  values (v_id, nullif(btrim(coalesce(current_setting('request.headers', true)::json->>'user-agent','')), ''));
exception when others then
  raise warning 'log_referral_click failed: %', sqlerrm;
end;
$$;

-- 4. check_voucher with referral handling
create or replace function public.check_voucher(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
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

    IF EXISTS (SELECT 1 FROM public.payments WHERE user_id = v_uid AND status = 'paid') THEN
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

-- 5. Commission triggers
create or replace function public.referral_on_payment_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists trg_referral_on_payment_paid on public.payments;
create trigger trg_referral_on_payment_paid
after update of status on public.payments
for each row
when (NEW.status = 'paid' and OLD.status is distinct from 'paid')
execute function public.referral_on_payment_paid();

create or replace function public.referral_on_payment_reversed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.referral_earnings
       set status = 'reversed'
     where payment_id = NEW.id and status in ('pending','available');
  exception when others then
    raise warning 'referral_on_payment_reversed failed for payment %: %', NEW.id, sqlerrm;
  end;
  return NEW;
end;
$$;

drop trigger if exists trg_referral_on_payment_reversed on public.payments;
create trigger trg_referral_on_payment_reversed
after update of status on public.payments
for each row
when (OLD.status = 'paid' and NEW.status <> 'paid')
execute function public.referral_on_payment_reversed();

-- 6. Hourly release job
create or replace function public.referral_release_available()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  create temp table if not exists _ref_released(referrer uuid) on commit drop;

  with upd as (
    update public.referral_earnings
       set status = 'available'
     where status = 'pending' and available_at <= now()
    returning referrer_user_id
  )
  insert into _ref_released(referrer) select distinct referrer_user_id from upd;

  for r in select distinct referrer from _ref_released loop
    insert into public.notifications (title, body, type, link_url, is_active, target_user_id)
    values (
      '💰 Hoa hồng đã rút được',
      'Bạn có hoa hồng vừa hết thời gian chờ. Vào trang Giới thiệu bạn để rút.',
      'referral', '/gioi-thieu', true, r.referrer
    );
  end loop;
end;
$$;

select cron.unschedule('referral-release-available')
 where exists (select 1 from cron.job where jobname = 'referral-release-available');
select cron.schedule('referral-release-available', '10 * * * *',
  $$select public.referral_release_available();$$);

-- 7. Payout RPCs
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

create or replace function public.admin_mark_referral_payout(
  p_payout_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if p_status = 'paid' then
    update public.referral_payouts
       set status = 'paid', paid_at = now(), paid_by = auth.uid(), admin_note = p_note
     where id = p_payout_id;
    update public.referral_earnings set status = 'paid' where payout_id = p_payout_id;
    insert into public.notifications (title, body, type, link_url, is_active, target_user_id)
    values (
      '✅ Đã chuyển hoa hồng ' || to_char(v_p.amount_vnd, 'FM999G999G999') || 'đ',
      'Hoa hồng giới thiệu của bạn đã được chuyển. Bạn kiểm tra tài khoản nhé.',
      'referral', '/gioi-thieu', true, v_p.user_id
    );
  else
    update public.referral_payouts
       set status = 'rejected', admin_note = p_note
     where id = p_payout_id;
    update public.referral_earnings set payout_id = null where payout_id = p_payout_id;
  end if;
end;
$$;

create or replace function public.get_my_referral_history()
returns table(
  created_at timestamptz,
  referred_name text,
  plan_key text,
  order_amount_vnd int,
  commission_percent int,
  commission_vnd int,
  status text,
  available_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.created_at,
         coalesce(p.display_name, 'Học viên') as referred_name,
         e.plan_key, e.order_amount_vnd, e.commission_percent, e.commission_vnd,
         e.status, e.available_at
    from public.referral_earnings e
    left join public.profiles p on p.user_id = e.referred_user_id
   where e.referrer_user_id = auth.uid()
   order by e.created_at desc;
$$;

grant execute on function public.referral_rate_for(uuid) to authenticated;
grant execute on function public.get_my_referral_code() to authenticated;
grant execute on function public.log_referral_click(text) to anon, authenticated;
grant execute on function public.request_referral_payout(text, text, text) to authenticated;
grant execute on function public.admin_mark_referral_payout(uuid, text, text) to authenticated;
grant execute on function public.get_my_referral_history() to authenticated;
