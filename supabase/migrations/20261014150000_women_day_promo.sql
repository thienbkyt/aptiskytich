-- Ưu đãi 20/10: tài khoản giới tính Nữ + có SĐT được giảm 20% gói từ 1 tuần trở lên,
-- 1 lần / tài khoản, 1 SĐT chỉ gắn 1 tài khoản, hết hạn 23:59 20/10/2026 (giờ VN).
alter table public.payments add column if not exists promo_key text;

create unique index if not exists profiles_phone_unique on public.profiles (phone) where phone is not null;

create or replace function public.women_day_promo_status(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_end timestamptz := '2026-10-20 23:59:59+07';
  v_phone text;
  v_gender text;
  v_used boolean;
  v_reason text := null;
begin
  if p_user is null then
    return jsonb_build_object('active', now() <= v_end, 'eligible', false, 'reason', 'not_logged_in', 'percent', 20, 'ends_at', v_end);
  end if;
  select phone, gender into v_phone, v_gender from public.profiles where user_id = p_user;
  select exists (
    select 1 from public.payments
    where user_id = p_user and promo_key = 'women_2010' and status = 'paid'
  ) into v_used;
  if now() > v_end then v_reason := 'expired';
  elsif v_used then v_reason := 'used';
  elsif coalesce(v_gender, '') <> 'female' and v_phone is null then v_reason := 'need_gender_phone';
  elsif coalesce(v_gender, '') <> 'female' then v_reason := 'need_gender';
  elsif v_phone is null then v_reason := 'need_phone';
  end if;
  return jsonb_build_object(
    'active', now() <= v_end,
    'eligible', v_reason is null,
    'reason', v_reason,
    'percent', 20,
    'plans', jsonb_build_array('week','month','quarter','half_year'),
    'ends_at', v_end
  );
end;
$$;

create or replace function public.get_my_women_day_promo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$ select public.women_day_promo_status(auth.uid()) $$;

revoke all on function public.women_day_promo_status(uuid) from public, anon, authenticated;
grant execute on function public.women_day_promo_status(uuid) to service_role;
revoke all on function public.get_my_women_day_promo() from public, anon;
grant execute on function public.get_my_women_day_promo() to authenticated;
