-- Ưu đãi 20/10 (bổ sung): tài khoản đã có Pro gói tuần trở lên còn hạn vào 00:00 15/10/2026
-- (không được giảm 20%) → cập nhật giới tính Nữ + SĐT trong 15–20/10 được tặng +3 ngày Pro, 1 lần.
create table if not exists public.women_day_bonus (
  user_id uuid primary key,
  granted_at timestamptz not null default now(),
  old_until timestamptz,
  new_until timestamptz
);
alter table public.women_day_bonus enable row level security;
drop policy if exists "own bonus read" on public.women_day_bonus;
create policy "own bonus read" on public.women_day_bonus for select to authenticated using ((select auth.uid()) = user_id);

-- Có Pro gói tuần+ còn hạn tại 00:00 15/10/2026?
create or replace function public.women_day_bonus_in_group(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.payments p
    join public.pricing_plans pp on pp.key = p.plan_key
    where p.user_id = p_user and p.status = 'paid'
      and p.plan_key in ('week','month','quarter','half_year')
      and p.paid_at < '2026-10-15 00:00:00+07'
      and p.paid_at + make_interval(days => coalesce(pp.duration_days, 0)) > '2026-10-15 00:00:00+07'
  ) or exists (
    select 1 from public.user_subscriptions s
    where s.user_id = p_user and s.tier = 'pro'
      and s.plan_key in ('week','month','quarter','half_year')
      and s.pro_until > '2026-10-15 00:00:00+07'
      and s.updated_at < '2026-10-15 00:00:00+07'
  )
$$;

-- Cấp +3 ngày nếu đủ điều kiện (idempotent). Trả về jsonb.
create or replace function public.women_day_bonus_grant(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz := '2026-10-15 00:00:00+07';
  v_end timestamptz := '2026-10-20 23:59:59+07';
  v_phone text; v_gender text; v_old timestamptz; v_new timestamptz;
begin
  if p_user is null then return jsonb_build_object('granted', false, 'reason', 'not_logged_in'); end if;
  if exists (select 1 from public.women_day_bonus where user_id = p_user) then
    return jsonb_build_object('granted', false, 'reason', 'already', 'already', true);
  end if;
  if now() < v_start or now() > v_end then return jsonb_build_object('granted', false, 'reason', 'not_active'); end if;
  if not public.women_day_bonus_in_group(p_user) then return jsonb_build_object('granted', false, 'reason', 'not_in_group'); end if;
  select phone, gender into v_phone, v_gender from public.profiles where user_id = p_user;
  if coalesce(v_gender, '') <> 'female' or v_phone is null then
    return jsonb_build_object('granted', false, 'reason', 'need_info', 'in_group', true);
  end if;
  select pro_until into v_old from public.user_subscriptions where user_id = p_user for update;
  v_new := greatest(coalesce(v_old, now()), now()) + interval '3 days';
  update public.user_subscriptions set pro_until = v_new, updated_at = now() where user_id = p_user and tier = 'pro';
  if not found then return jsonb_build_object('granted', false, 'reason', 'no_subscription'); end if;
  insert into public.women_day_bonus (user_id, old_until, new_until) values (p_user, v_old, v_new)
  on conflict (user_id) do nothing;
  return jsonb_build_object('granted', true, 'old_until', v_old, 'new_until', v_new);
end;
$$;

create or replace function public.claim_women_day_bonus()
returns jsonb language sql security definer set search_path = public as $$ select public.women_day_bonus_grant(auth.uid()) $$;

-- Tự cấp ngay khi học viên lưu giới tính/SĐT trong thời gian ưu đãi
create or replace function public.trg_women_day_bonus_on_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.gender = 'female' and new.phone is not null
     and (old.gender is distinct from new.gender or old.phone is distinct from new.phone) then
    perform public.women_day_bonus_grant(new.user_id);
  end if;
  return new;
exception when others then
  return new; -- không bao giờ chặn việc lưu hồ sơ
end;
$$;
drop trigger if exists women_day_bonus_on_profile on public.profiles;
create trigger women_day_bonus_on_profile after update of gender, phone on public.profiles
for each row execute function public.trg_women_day_bonus_on_profile();

revoke all on function public.women_day_bonus_in_group(uuid) from public, anon, authenticated;
revoke all on function public.women_day_bonus_grant(uuid) from public, anon, authenticated;
grant execute on function public.women_day_bonus_in_group(uuid) to service_role;
grant execute on function public.women_day_bonus_grant(uuid) to service_role;
revoke all on function public.claim_women_day_bonus() from public, anon;
grant execute on function public.claim_women_day_bonus() to authenticated;
revoke all on function public.trg_women_day_bonus_on_profile() from public, anon, authenticated;

-- Trạng thái ưu đãi trả thêm thông tin quà +3 ngày cho banner/popup
create or replace function public.get_my_women_day_promo()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.women_day_promo_status(auth.uid())
    || jsonb_build_object(
      'bonus_in_group', coalesce(public.women_day_bonus_in_group(auth.uid()), false),
      'bonus_granted', exists (select 1 from public.women_day_bonus b where b.user_id = auth.uid()),
      'bonus_days', 3
    )
$$;
revoke all on function public.get_my_women_day_promo() from public, anon;
grant execute on function public.get_my_women_day_promo() to authenticated;
