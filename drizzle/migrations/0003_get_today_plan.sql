create or replace function public.get_today_plan()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
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
),
weakest as (
  select skill, part, count(*) n, sum(score)::numeric c, sum(total)::numeric t
  from runs where rn <= 5
  group by skill, part having count(*) >= 2
  order by (sum(score)::numeric / sum(total)::numeric) asc limit 1
),
key_today as (
  select k.id from public.prediction_keys k
  where k.is_published and k.date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
  order by k.date desc limit 1
),
key_sets as (
  select i.exam_set_id, s.title, s.skill, s.part
  from public.prediction_items i
  join public.exam_sets s on s.id = i.exam_set_id
  where i.key_id = (select id from key_today)
    and i.priority = 'high' and s.is_published
    and not exists (select 1 from public.test_results r
                    where r.user_id = (select uid from me) and r.exam_set_id = i.exam_set_id)
  order by i.sort_order limit 2
),
latest_per_set as (
  select distinct on (r.exam_set_id) r.exam_set_id, r.review_snapshot, s.skill, s.part
  from public.test_results r
  join public.exam_sets s on s.id = r.exam_set_id
  where r.user_id = (select uid from me)
    and s.skill in ('grammar_vocab','reading','listening')
    and r.full_test_session_id is null
    and coalesce(r.skill_scores->>'mode','') not like 'marathon%'
  order by r.exam_set_id, r.created_at desc
),
wrong_items as (
  select l.skill, l.part
  from latest_per_set l,
       lateral jsonb_array_elements(coalesce(l.review_snapshot->'raw'->'perQuestion','[]'::jsonb)) pq
  where coalesce((pq->>'is_correct')::boolean, false) = false
),
wrong_sum as (
  select count(*) n,
         (select string_agg(x.lbl, ', ')
            from (select w.skill || ' ' || split_part(w.part, ' -', 1) || ' (' || count(*) || ' câu)' lbl
                  from wrong_items w group by w.skill, w.part
                  order by count(*) desc limit 2) x) detail
  from wrong_items
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
goal as (select exam_date from public.user_goals where user_id = (select uid from me)),
items as (
  select 1 ord, jsonb_build_object(
    'kind','weak_part','skill',skill,'part',part,
    'avg_pct', round(c/t*100), 'runs', n) body from weakest
  union all
  select 2, jsonb_build_object(
    'kind','key_sets','sets',
    (select jsonb_agg(jsonb_build_object('exam_set_id',exam_set_id,'title',title,'skill',skill,'part',part)) from key_sets))
  where exists (select 1 from key_sets)
  union all
  select 3, jsonb_build_object('kind','wrong','count',n,'detail',detail) from wrong_sum where n > 0
  union all
  select 4, jsonb_build_object('kind','grammar_error','group',grp,'times',n) from top_err
  union all
  select 5, jsonb_build_object('kind','countdown','days',
    (exam_date - (now() at time zone 'Asia/Ho_Chi_Minh')::date))
  from goal where exam_date is not null
    and exam_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
    and exam_date - (now() at time zone 'Asia/Ho_Chi_Minh')::date <= 5
)
select coalesce((select jsonb_agg(body order by ord) from items), '[]'::jsonb);
$$;

grant execute on function public.get_today_plan() to authenticated;