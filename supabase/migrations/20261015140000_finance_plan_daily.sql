-- Số bill + doanh thu theo ngày (giờ VN) và theo gói, dùng cho biểu đồ "Số bill theo ngày" tab Doanh thu /crmcodong
CREATE OR REPLACE FUNCTION public.finance_plan_daily(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_ok boolean; v_res jsonb;
begin
  select true into v_ok from finance_tokens
  where token = p_token and is_active and (expires_at is null or expires_at > now());
  if v_ok is not true then raise exception 'Link không hợp lệ hoặc đã bị thu hồi'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('d',d,'k',k,'n',n,'dt',dt) order by d,k),'[]'::jsonb) into v_res
  from (select (coalesce(paid_at,created_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text d,
               coalesce(plan_key,'khac') k, count(*)::int n, sum(amount_vnd)::bigint dt
        from payments where status='paid' group by 1,2) x;
  return v_res;
end;
$function$;
GRANT EXECUTE ON FUNCTION public.finance_plan_daily(text) TO anon, authenticated;
