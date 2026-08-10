CREATE OR REPLACE FUNCTION public.create_custom_set(p_title text, p_mode text, p_skill text, p_exam_set_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_tier text;
  v_count int;
  v_rows int;
  v_new_id uuid;
  v_missing text[] := '{}';
  v_required jsonb := jsonb_build_object('reading',4,'listening',4,'writing',4,'speaking',4,'grammar_vocab',6);
  v_skill text;
  v_need int;
  v_have int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  if p_mode not in ('full_test','full_part') then
    return jsonb_build_object('ok', false, 'reason', 'bad_mode');
  end if;
  if p_mode = 'full_part' and (p_skill is null or not (v_required ? p_skill)) then
    return jsonb_build_object('ok', false, 'reason', 'bad_skill');
  end if;
  if coalesce(array_length(p_exam_set_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  select coalesce(tier, 'free') into v_tier
  from public.user_subscriptions
  where user_id = v_uid and (pro_until is null or pro_until > now());

  if coalesce(v_tier, 'free') = 'free' then
    select count(*) into v_count from public.custom_sets where user_id = v_uid;
    if v_count >= 1 then
      return jsonb_build_object('ok', false, 'reason', 'free_limit');
    end if;
  end if;

  create temp table _sel on commit drop as
  select distinct s.id, s.skill, s.part
  from public.exam_sets s
  where s.id = any(p_exam_set_ids) and s.is_published;

  select count(*) into v_rows from _sel;
  if v_rows <> (select count(distinct x) from unnest(p_exam_set_ids) x) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_sets');
  end if;

  -- chặn user chưa đủ hạng đưa đề pro vào bộ
  if coalesce(v_tier,'free') = 'free'
     and not public.promo_active()
     and exists (select 1 from public.exam_sets s
                 where s.id = any(p_exam_set_ids)
                   and coalesce(s.access_tier,'pro') <> 'free') then
    return jsonb_build_object('ok', false, 'reason', 'tier_locked');
  end if;

  -- duplicate part within same skill -> block
  if exists (select 1 from _sel group by skill, part having count(*) > 1) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_part');
  end if;

  if p_mode = 'full_part' then
    if exists (select 1 from _sel where skill <> p_skill) then
      return jsonb_build_object('ok', false, 'reason', 'wrong_skill');
    end if;
    v_need := (v_required ->> p_skill)::int;
    select count(distinct part) into v_have from _sel;
    if v_have < v_need then
      return jsonb_build_object('ok', false, 'reason', 'missing_parts',
        'missing', jsonb_build_array(p_skill));
    end if;
  else
    for v_skill in select jsonb_object_keys(v_required) loop
      v_need := (v_required ->> v_skill)::int;
      select count(distinct part) into v_have from _sel where skill = v_skill;
      if v_have < v_need then
        v_missing := v_missing || v_skill;
      end if;
    end loop;
    if array_length(v_missing, 1) > 0 then
      return jsonb_build_object('ok', false, 'reason', 'missing_parts', 'missing', to_jsonb(v_missing));
    end if;
  end if;

  insert into public.custom_sets (user_id, title, mode, skill)
  values (v_uid, p_title, p_mode, case when p_mode = 'full_part' then p_skill else null end)
  returning id into v_new_id;

  insert into public.custom_set_members (custom_set_id, exam_set_id, position)
  select v_new_id, t.id, t.pos
  from (
    select id, (row_number() over (order by skill, part))::int - 1 as pos from _sel
  ) t;

  return jsonb_build_object('ok', true, 'id', v_new_id);
end;
$function$;