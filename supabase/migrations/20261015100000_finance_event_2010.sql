-- Báo cáo chương trình 20/10 (15/10 00:00 → 20/10 23:59:59 giờ VN)
-- Chỉ đọc. Không sửa payments / women_day_bonus. Kiểm token giống finance_report.
CREATE OR REPLACE FUNCTION public.finance_event_2010(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_ok boolean; v_name text; v_res jsonb;
  es  constant timestamptz := timestamptz '2026-10-14 17:00:00+00';  -- 15/10 00:00 VN
  ee  constant timestamptz := timestamptz '2026-10-20 17:00:00+00';  -- 21/10 00:00 VN (độc quyền)
  bs  constant timestamptz := timestamptz '2026-10-08 17:00:00+00';  -- 09/10 00:00 VN
  v_now timestamptz := now();
  v_el interval;
begin
  select true, viewer_name into v_ok, v_name from finance_tokens
  where token = p_token and is_active and (expires_at is null or expires_at > now());
  if v_ok is not true then raise exception 'Link không hợp lệ hoặc đã bị thu hồi'; end if;

  v_el := greatest(least(v_now, ee) - es, interval '0');

  with adm as (select user_id from user_roles where role = 'admin'),
  p as (
    select y.id, y.user_id, y.plan_key, y.amount_vnd, y.status, y.created_at,
           coalesce(y.paid_at, y.created_at) t,
           coalesce(y.promo_key = 'women_2010', false) w
    from payments y
    where y.user_id is null or y.user_id not in (select user_id from adm)
  ),
  ev as (select * from p where status = 'paid' and t >= es and t < ee),
  bf as (select * from p where status = 'paid' and t >= bs and t < es),
  bsame as (select * from p where status = 'paid' and t >= bs and t < bs + v_el),
  wf as (select * from p where w and created_at >= es and created_at < ee),
  days as (select generate_series(date '2026-10-15', date '2026-10-20', interval '1 day')::date d),
  plans as (select key, label, price_vnd, sort_order from pricing_plans where key in ('day','week','month','quarter','half_year'))
  select jsonb_build_object(
    'viewer', v_name,
    'as_of', to_char(v_now AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'),
    'status', case when v_now < es then 'upcoming' when v_now < ee then 'running' else 'ended' end,
    'window', jsonb_build_object('start','15/10/2026 00:00','end','20/10/2026 23:59:59',
                                 'base_start','09/10/2026 00:00','base_end','14/10/2026 23:59:59'),
    'elapsed_hours', round(extract(epoch from v_el) / 3600.0, 2),
    'ev', (select jsonb_build_object('rev', coalesce(sum(amount_vnd),0), 'n', count(*),
             'buyers', count(distinct user_id),
             'arpu', case when count(*) > 0 then round(sum(amount_vnd)::numeric / count(*)) else 0 end) from ev),
    'base_full', (select jsonb_build_object('rev', coalesce(sum(amount_vnd),0), 'n', count(*),
             'buyers', count(distinct user_id),
             'arpu', case when count(*) > 0 then round(sum(amount_vnd)::numeric / count(*)) else 0 end) from bf),
    'base_same', (select jsonb_build_object('rev', coalesce(sum(amount_vnd),0), 'n', count(*),
             'buyers', count(distinct user_id),
             'arpu', case when count(*) > 0 then round(sum(amount_vnd)::numeric / count(*)) else 0 end) from bsame),
    'women', (select jsonb_build_object('n', count(*), 'rev', coalesce(sum(ev.amount_vnd),0),
             'buyers', count(distinct ev.user_id),
             'list', coalesce(sum(pl.price_vnd),0),
             'disc', coalesce(sum(pl.price_vnd - ev.amount_vnd),0))
             from ev left join pricing_plans pl on pl.key = ev.plan_key where ev.w),
    'funnel', (select jsonb_build_object(
             'links', count(*),
             'links_paid', count(*) filter (where status = 'paid'),
             'links_pending', count(*) filter (where status = 'pending'),
             'links_expired', count(*) filter (where status in ('expired','failed')),
             'users', count(distinct user_id),
             'users_paid', count(distinct user_id) filter (where status = 'paid')) from wf),
    'by_plan', (select coalesce(jsonb_agg(jsonb_build_object(
             'key', pl.key, 'label', pl.label, 'price', pl.price_vnd,
             'w_n', (select count(*) from ev where ev.plan_key = pl.key and ev.w),
             'w_rev', (select coalesce(sum(amount_vnd),0) from ev where ev.plan_key = pl.key and ev.w),
             'o_n', (select count(*) from ev where ev.plan_key = pl.key and not ev.w),
             'o_rev', (select coalesce(sum(amount_vnd),0) from ev where ev.plan_key = pl.key and not ev.w))
             order by pl.sort_order, pl.price_vnd), '[]'::jsonb) from plans pl),
    'by_plan_other', (select jsonb_build_object('n', count(*), 'rev', coalesce(sum(amount_vnd),0))
             from ev where plan_key is null or plan_key not in ('day','week','month','quarter','half_year')),
    'by_day', (select jsonb_agg(jsonb_build_object(
             'd', to_char(dd.d, 'YYYY-MM-DD'),
             'w_n', (select count(*) from ev where (ev.t AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = dd.d and ev.w),
             'w_rev', (select coalesce(sum(amount_vnd),0) from ev where (ev.t AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = dd.d and ev.w),
             'o_n', (select count(*) from ev where (ev.t AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = dd.d and not ev.w),
             'o_rev', (select coalesce(sum(amount_vnd),0) from ev where (ev.t AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = dd.d and not ev.w))
             order by dd.d) from days dd),
    'newret', (select jsonb_build_object(
             'new_u', count(distinct user_id) filter (where not r), 'new_n', count(*) filter (where not r),
             'new_rev', coalesce(sum(amount_vnd) filter (where not r),0),
             'ret_u', count(distinct user_id) filter (where r), 'ret_n', count(*) filter (where r),
             'ret_rev', coalesce(sum(amount_vnd) filter (where r),0))
             from (select ev.*, exists (select 1 from payments q where q.user_id = ev.user_id and q.status = 'paid'
                                          and coalesce(q.paid_at, q.created_at) < es) r from ev) x),
    'bonus', (select jsonb_build_object('n', count(*), 'users', count(distinct user_id),
             'days', coalesce(round(sum(extract(epoch from (new_until - old_until))) / 86400.0, 1), 0),
             'last', to_char(max(granted_at) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI'))
             from women_day_bonus),
    'profiles', (select jsonb_build_object(
             'female', count(*),
             'female_phone', count(*) filter (where coalesce(trim(phone),'') <> ''),
             'female_phone_bought', count(*) filter (where coalesce(trim(phone),'') <> ''
                                         and user_id in (select user_id from ev)),
             'female_phone_bought_women', count(*) filter (where coalesce(trim(phone),'') <> ''
                                         and user_id in (select user_id from ev where w)))
             from profiles where gender = 'female')
  ) into v_res;
  return v_res;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.finance_event_2010(text) TO anon, authenticated;
