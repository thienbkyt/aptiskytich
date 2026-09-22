CREATE OR REPLACE FUNCTION public.showcase_consent(p_test_result_id uuid, p_part_type text, p_display_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_tr record;
  v_skill text;
  v_raw numeric;
  v_band text;
  v_content text;
  v_questions jsonb;
  v_parts jsonb;
  v_part jsonb;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_tr from public.test_results where id = p_test_result_id;
  if v_tr is null or v_tr.user_id <> v_uid then
    raise exception 'forbidden';
  end if;

  if p_part_type ~ '^task[2-4]$' then
    v_skill := 'writing';
  elsif p_part_type ~ '^part[2-4]$' then
    v_skill := 'speaking';
  else
    raise exception 'not_eligible';
  end if;

  if (select count(*) from public.showcase_entries
      where user_id = v_uid and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'daily_limit';
  end if;

  if v_skill = 'writing' then
    select parts into v_parts from public.writing_skill_results
      where test_result_id = p_test_result_id order by created_at desc limit 1;
    v_part := coalesce(v_parts -> p_part_type, '{}'::jsonb);
    v_raw := coalesce(
      nullif(v_part ->> 'rawPart', '')::numeric,
      (select part_score from public.writing_question_gradings
        where test_result_id = p_test_result_id and part = p_part_type
        order by created_at desc limit 1)
    );
    v_content := coalesce(
      nullif(case when v_tr.grade_payload ->> 'partType' = p_part_type
                  then v_tr.grade_payload ->> 'text' end, ''),
      nullif(case when v_tr.review_snapshot -> 'raw' ->> 'partType' = p_part_type
                  then v_tr.review_snapshot -> 'raw' ->> 'text' end, ''),
      nullif(case when replace(coalesce(v_tr.review_snapshot ->> 'part', ''), 'part', 'task') = p_part_type
                  then v_tr.review_snapshot -> 'items' -> 0 ->> 'userAnswer' end, ''),
      nullif(v_part ->> 'text', '')
    );
    v_questions := coalesce(
      case when v_tr.review_snapshot -> 'raw' ->> 'partType' = p_part_type
           then v_tr.review_snapshot -> 'raw' -> 'questions' end,
      case when v_tr.grade_payload ->> 'partType' = p_part_type
           then v_tr.grade_payload -> 'questions' end,
      case when replace(coalesce(v_tr.review_snapshot ->> 'part', ''), 'part', 'task') = p_part_type
           then (select jsonb_agg(i ->> 'questionText')
                   from jsonb_array_elements(coalesce(v_tr.review_snapshot -> 'items', '[]'::jsonb)) i
                  where nullif(i ->> 'questionText', '') is not null) end
    );
  else
    select parts into v_parts from public.speaking_skill_results
      where test_result_id = p_test_result_id order by created_at desc limit 1;
    v_part := coalesce(v_parts -> p_part_type, '{}'::jsonb);
    v_raw := coalesce(
      nullif(v_part ->> 'rawPart', '')::numeric,
      (select max(part_score) from public.speaking_question_gradings
        where test_result_id = p_test_result_id and part = p_part_type)
    );
    v_content := nullif(trim(coalesce(
      nullif(v_part ->> 'fullTranscript', ''),
      (select string_agg(nullif(trim(i ->> 'transcript'), ''), E'\n')
         from jsonb_array_elements(coalesce(v_part -> 'items', '[]'::jsonb)) i),
      (select string_agg(nullif(trim(transcript), ''), E'\n' order by item_index)
         from public.speaking_question_gradings
         where test_result_id = p_test_result_id and part = p_part_type)
    )), '');
    v_questions := coalesce(
      (select jsonb_agg(i ->> 'questionText')
         from jsonb_array_elements(coalesce(v_part -> 'items', '[]'::jsonb)) i
        where nullif(i ->> 'questionText', '') is not null),
      (select jsonb_agg(question_text order by item_index)
         from public.speaking_question_gradings
         where test_result_id = p_test_result_id and part = p_part_type)
    );
  end if;

  if v_raw is null then
    raise exception 'not_eligible';
  end if;

  if v_raw >= 28 then
    v_band := 'C';
  elsif v_raw >= 26 and v_raw < 28 then
    v_band := 'B2';
  elsif v_raw >= 21 and v_raw < 23 then
    v_band := 'B1';
  else
    raise exception 'not_eligible';
  end if;

  if v_content is null or length(trim(v_content)) = 0 then
    raise exception 'not_eligible';
  end if;

  if exists (select 1 from public.showcase_entries
             where test_result_id = p_test_result_id
               and part_type = p_part_type
               and status not in ('withdrawn', 'rejected')) then
    raise exception 'already_submitted';
  end if;

  insert into public.showcase_entries (
    user_id, test_result_id, skill, part_type, exam_set_id, band, raw_part,
    content_text, question_texts, display_name, status
  ) values (
    v_uid, p_test_result_id, v_skill, p_part_type, v_tr.exam_set_id, v_band, v_raw,
    v_content, v_questions, nullif(trim(coalesce(p_display_name, '')), ''), 'checking'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_today_plan()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with me as (select auth.uid() as uid),
runs as (
  select s.skill, s.part, r.score, r.total,
         row_number() over (partition by s.skill, s.part order by r.created_at desc) rn
  from public.test_results r
  join public.exam_sets s on s.id = r.exam_set_id
  where r.user_id = (select uid from me)
    and s.skill in ('grammar_vocab','reading','listening')
    and r.total > 0
    and coalesce(r.skill_scores->>'mode','') not like 'marathon%'
    and coalesce(r.skill_scores->>'mode','') <> 'wrong-retry'
),
weakest as (
  select skill, part, count(*) n, sum(score)::numeric c, sum(total)::numeric t
  from runs where rn <= 5
  group by skill, part having count(*) >= 2
  order by (sum(score)::numeric / sum(total)::numeric) asc limit 1
),
latest_per_set as (
  select distinct on (r.exam_set_id) r.exam_set_id, r.review_snapshot, s.skill, s.part, r.score, r.total
  from public.test_results r
  join public.exam_sets s on s.id = r.exam_set_id
  where r.user_id = (select uid from me)
    and s.skill in ('reading','listening')
    and r.total > 0
    and r.full_test_session_id is null
    and coalesce(r.skill_scores->>'mode','') not like 'marathon%'
  order by r.exam_set_id, r.created_at desc
),
wrong_sum as (
  select coalesce(sum(l.total - l.score), 0) n,
         (select string_agg(x.lbl, ', ')
            from (select w.skill || ' ' || split_part(w.part, ' -', 1) || ' (' || sum(w.total - w.score) || ' câu)' lbl
                    from latest_per_set w where w.score < w.total
                   group by w.skill, w.part order by sum(w.total - w.score) desc limit 2) x) detail
  from latest_per_set l where l.score < l.total
),
gerr as (
  select e->>'explanation' ex
  from (select grammar_errors from public.writing_question_gradings
        where user_id = (select uid from me) and grammar_errors is not null
        order by created_at desc limit 10) g,
       lateral jsonb_array_elements(g.grammar_errors) e
),
gerr_grp as (
  select case
    when ex ilike '%mạo từ%' then 'mạo từ (a/an/the)'
    when ex ilike '%số nhiều%' or ex ilike '%số ít%' then 'số ít / số nhiều'
    when ex ilike '%giới từ%' then 'giới từ'
    when ex ilike '%bị động%' then 'câu bị động'
    when ex ilike '%chủ ngữ%' then 'hoà hợp chủ ngữ – động từ'
    when ex ilike '%thì %' or ex ilike '%quá khứ%' or ex ilike '%hiện tại%' then 'chia thì động từ'
    else null end grp
  from gerr
),
top_err as (
  select grp, count(*) n from gerr_grp where grp is not null
  group by grp having count(*) >= 3 order by count(*) desc limit 1
),
items as (
  select 1 ord, jsonb_build_object(
    'kind','weak_part','skill',skill,'part',part,
    'avg_pct', round(c/t*100), 'runs', n) body from weakest
  union all
  select 3, jsonb_build_object('kind','wrong','count',n,'detail',detail) from wrong_sum where n > 0
  union all
  select 4, jsonb_build_object('kind','grammar_error','group',grp,'times',n) from top_err
)
select coalesce((select jsonb_agg(body order by ord) from items), '[]'::jsonb);
$function$;