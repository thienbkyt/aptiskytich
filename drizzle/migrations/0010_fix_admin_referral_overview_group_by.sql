create or replace function public.admin_referral_overview(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(coalesce(p_days,30),1));
  v_res jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'days', greatest(coalesce(p_days,30),1),
    'clicks', (select count(*) from public.referral_clicks where clicked_at >= v_from),
    'orders', (select count(*) from public.referral_earnings
               where created_at >= v_from and status <> 'reversed'),
    'revenue_vnd', (select coalesce(sum(order_amount_vnd),0) from public.referral_earnings
                    where created_at >= v_from and status <> 'reversed'),
    'commission_vnd', (select coalesce(sum(commission_vnd),0) from public.referral_earnings
                       where created_at >= v_from and status <> 'reversed'),
    'paid_vnd', (select coalesce(sum(commission_vnd),0) from public.referral_earnings
                 where created_at >= v_from and status = 'paid'),
    'owed_vnd', (select coalesce(sum(commission_vnd),0) from public.referral_earnings
                 where created_at >= v_from and status in ('pending','available')),
    'top', (
      select coalesce(jsonb_agg(t order by n desc), '[]'::jsonb) from (
        select count(*) as n, jsonb_build_object(
          'user_id', e.referrer_user_id,
          'name', coalesce(p.display_name, 'Học viên'),
          'n', count(*),
          'commission_vnd', coalesce(sum(e.commission_vnd),0),
          'percent', (select referrer_percent from public.referral_rate_for(e.referrer_user_id)),
          'last_at', max(e.created_at)
        ) as t
        from public.referral_earnings e
        left join public.profiles p on p.user_id = e.referrer_user_id
        where e.status <> 'reversed'
        group by e.referrer_user_id, p.display_name
        order by count(*) desc
        limit 20
      ) s
    ),
    'burst', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', e.referrer_user_id,
        'name', coalesce(p.display_name, 'Học viên'),
        'n', count(*)
      )), '[]'::jsonb)
      from public.referral_earnings e
      left join public.profiles p on p.user_id = e.referrer_user_id
      where e.created_at >= now() - interval '24 hours'
      group by e.referrer_user_id, p.display_name
      having count(*) >= 5
    ),
    'bank_dup', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'referrer_name', coalesce(pa.display_name,'Học viên'),
        'referred_name', coalesce(pb.display_name,'Học viên'),
        'bank_account', pa.bank_account
      )), '[]'::jsonb)
      from public.referral_earnings e
      join public.profiles pa on pa.user_id = e.referrer_user_id
      join public.profiles pb on pb.user_id = e.referred_user_id
      where e.status <> 'reversed'
        and coalesce(regexp_replace(pa.bank_account,'\D','','g'),'') <> ''
        and regexp_replace(pa.bank_account,'\D','','g') = regexp_replace(coalesce(pb.bank_account,''),'\D','','g')
    )
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.admin_referral_overview(int) from public;
grant execute on function public.admin_referral_overview(int) to authenticated;