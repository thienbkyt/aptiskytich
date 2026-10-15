-- Nhân sự: thêm ngày nghỉ việc; Nguyên nghỉ từ 01/10/2026; Châu hưởng 100% lương từ 01/10/2026
ALTER TABLE public.hr_staff ADD COLUMN IF NOT EXISTS end_date date;

UPDATE public.hr_staff SET end_date = DATE '2026-09-30' WHERE id = 'nguyen';
UPDATE public.hr_staff SET probation_until = DATE '2026-09-30',
  note = 'Thử việc 03/09–30/09 (85%), từ 01/10 hưởng 100%. Tăng ca tính thêm theo đơn giá buổi.'
WHERE id = 'chau';
UPDATE public.hr_staff SET note = 'Khoán 1,5tr/tháng cố định, không tính ngày công. Nghỉ từ 01/10/2026.'
WHERE id = 'nguyen';

CREATE OR REPLACE FUNCTION public.finance_hr(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ok boolean; v_result jsonb;
begin
  select true into v_ok from finance_tokens
  where token = p_token and is_active and (expires_at is null or expires_at > now());
  if v_ok is not true then raise exception 'Link không hợp lệ hoặc đã bị thu hồi'; end if;

  select jsonb_build_object(
    'staff', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',id,'name',full_name,'pos',position,'ct',contract_type,
        'base',base_salary_vnd,'rate',probation_rate,'allow',allowance_vnd,
        'start',start_date::text,'prob',probation_until::text,'end',end_date::text,
        'unit',unit,'spd',slots_per_day,'sched',schedule_note,'note',note
      ) order by sort_order),'[]'::jsonb) from hr_staff where active),
    'att', (
      select coalesce(jsonb_agg(jsonb_build_object(
        's',staff_id,'d',work_date::text,'sl',slot,'k',kind,'st',status
      ) order by work_date, staff_id),'[]'::jsonb) from hr_attendance)
  ) into v_result;
  return v_result;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.finance_hr(text) TO anon, authenticated;
