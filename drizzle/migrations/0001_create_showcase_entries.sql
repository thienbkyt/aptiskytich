-- 1) Table
create table public.showcase_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_result_id uuid not null references public.test_results(id) on delete cascade,
  skill text not null check (skill in ('writing','speaking')),
  part_type text not null,
  exam_set_id uuid references public.exam_sets(id) on delete set null,
  band text not null check (band in ('B1','B2','C')),
  raw_part numeric not null,
  content_text text not null,
  question_texts jsonb,
  display_name text,
  status text not null default 'checking' check (status in ('checking','approved','rejected','withdrawn','hidden')),
  ai_check jsonb,
  extraction jsonb,
  created_at timestamptz default now(),
  approved_at timestamptz,
  unique (test_result_id, part_type)
);

grant select on public.showcase_entries to anon, authenticated;
grant all on public.showcase_entries to service_role;

create index showcase_entries_set_band_idx
  on public.showcase_entries (status, exam_set_id, band, raw_part desc);
create index showcase_entries_skill_part_idx
  on public.showcase_entries (status, skill, part_type, raw_part desc);
create index showcase_entries_user_idx on public.showcase_entries (user_id);

-- 2) RLS
alter table public.showcase_entries enable row level security;

create policy "Anyone can read approved showcase entries"
  on public.showcase_entries for select
  using (status = 'approved');

create policy "Owners can read their own showcase entries"
  on public.showcase_entries for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can read all showcase entries"
  on public.showcase_entries for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update showcase entries"
  on public.showcase_entries for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
-- No INSERT / client UPDATE policies: all writes go through RPCs / service role.

-- 3) Consent RPC
create or replace function public.showcase_consent(
  p_test_result_id uuid,
  p_part_type text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
      nullif(v_part ->> 'text', '')
    );
    v_questions := coalesce(
      case when v_tr.review_snapshot -> 'raw' ->> 'partType' = p_part_type
           then v_tr.review_snapshot -> 'raw' -> 'questions' end,
      case when v_tr.grade_payload ->> 'partType' = p_part_type
           then v_tr.grade_payload -> 'questions' end
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
             where test_result_id = p_test_result_id and part_type = p_part_type) then
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
$$;

revoke all on function public.showcase_consent(uuid, text, text) from public;
grant execute on function public.showcase_consent(uuid, text, text) to authenticated;

-- 4) Showcase by set (3 random out of top 15)
create or replace function public.get_showcase_by_set(
  p_exam_set_id uuid,
  p_band text,
  p_seed int default 0
)
returns table (
  id uuid,
  band text,
  raw_part numeric,
  display_name text,
  created_at timestamptz,
  preview text
)
language sql
stable
security definer
set search_path = public
as $$
  with top15 as (
    select e.id, e.band, e.raw_part, e.display_name, e.created_at, e.content_text
    from public.showcase_entries e
    where e.status = 'approved'
      and e.exam_set_id = p_exam_set_id
      and e.band = p_band
    order by e.raw_part desc, e.approved_at desc nulls last
    limit 15
  )
  select t.id, t.band, t.raw_part, t.display_name, t.created_at,
         (select string_agg(l, E'\n')
            from (select l from unnest(string_to_array(t.content_text, E'\n')) l limit 2) s)
           as preview
  from top15 t
  order by md5(t.id::text || p_seed::text)
  limit 3;
$$;

grant execute on function public.get_showcase_by_set(uuid, text, int) to anon, authenticated;

-- 5) Board listing
create or replace function public.get_showcase_board(
  p_skill text default null,
  p_part_type text default null,
  p_band text default null,
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  skill text,
  part_type text,
  band text,
  raw_part numeric,
  display_name text,
  exam_set_id uuid,
  exam_set_title text,
  approved_at timestamptz,
  created_at timestamptz,
  preview text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select e.*, s.title as exam_set_title
    from public.showcase_entries e
    left join public.exam_sets s on s.id = e.exam_set_id
    where e.status = 'approved'
      and (p_skill is null or e.skill = p_skill)
      and (p_part_type is null or e.part_type = p_part_type)
      and (p_band is null or e.band = p_band)
      and (
        p_search is null or trim(p_search) = ''
        or s.title ilike '%' || trim(p_search) || '%'
      )
  )
  select f.id, f.skill, f.part_type, f.band, f.raw_part, f.display_name,
         f.exam_set_id, f.exam_set_title, f.approved_at, f.created_at,
         (select string_agg(l, E'\n')
            from (select l from unnest(string_to_array(f.content_text, E'\n')) l limit 2) x)
           as preview,
         (select count(*) from filtered) as total_count
  from filtered f
  order by f.raw_part desc, f.approved_at desc nulls last
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.get_showcase_board(text, text, text, text, int, int) to anon, authenticated;

-- 6) Detail
create or replace function public.get_showcase_detail(p_id uuid)
returns table (
  id uuid,
  skill text,
  part_type text,
  band text,
  raw_part numeric,
  display_name text,
  content_text text,
  question_texts jsonb,
  extraction jsonb,
  exam_set_id uuid,
  exam_set_title text,
  approved_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.skill, e.part_type, e.band, e.raw_part, e.display_name,
         e.content_text, e.question_texts, e.extraction,
         e.exam_set_id, s.title, e.approved_at, e.created_at
  from public.showcase_entries e
  left join public.exam_sets s on s.id = e.exam_set_id
  where e.id = p_id and e.status = 'approved';
$$;

grant execute on function public.get_showcase_detail(uuid) to anon, authenticated;