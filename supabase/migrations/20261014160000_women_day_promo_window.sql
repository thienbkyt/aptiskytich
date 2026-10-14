-- Ưu đãi 20/10: áp dụng từ 00:00 15/10/2026 đến 23:59:59 20/10/2026 (giờ VN).
create or replace function public.women_day_promo_status(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_start timestamptz := '2026-10-15 00:00:00+07';
  v_end timestamptz := '2026-10-20 23:59:59+07';
  v_active boolean := now() >= v_start and now() <= v_end;
  v_phone text; v_gender text; v_used boolean; v_reason text := null;
begin
  if p_user is null then
    return jsonb_build_object('active', v_active, 'eligible', false, 'reason', 'not_logged_in', 'percent', 20, 'starts_at', v_start, 'ends_at', v_end);
  end if;
  select phone, gender into v_phone, v_gender from public.profiles where user_id = p_user;
  select exists (select 1 from public.payments where user_id = p_user and promo_key = 'women_2010' and status = 'paid') into v_used;
  if now() < v_start then v_reason := 'not_started';
  elsif now() > v_end then v_reason := 'expired';
  elsif v_used then v_reason := 'used';
  elsif coalesce(v_gender, '') <> 'female' and v_phone is null then v_reason := 'need_gender_phone';
  elsif coalesce(v_gender, '') <> 'female' then v_reason := 'need_gender';
  elsif v_phone is null then v_reason := 'need_phone';
  end if;
  return jsonb_build_object('active', v_active, 'eligible', v_reason is null, 'reason', v_reason, 'percent', 20,
    'plans', jsonb_build_array('week','month','quarter','half_year'), 'starts_at', v_start, 'ends_at', v_end);
end; $$;
revoke all on function public.women_day_promo_status(uuid) from public, anon, authenticated;
grant execute on function public.women_day_promo_status(uuid) to service_role;
