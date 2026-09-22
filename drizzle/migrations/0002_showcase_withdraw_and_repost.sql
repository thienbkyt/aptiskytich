create or replace function public.showcase_withdraw(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select user_id into v_owner from public.showcase_entries where id = p_entry_id;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'forbidden';
  end if;

  update public.showcase_entries
     set status = 'withdrawn',
         approved_at = null
   where id = p_entry_id;
end;
$$;

grant execute on function public.showcase_withdraw(uuid) to authenticated;

-- allow re-posting a previously withdrawn or rejected entry
create or replace function public.showcase_consent(p_test_result_id uuid, p_part_type text, p_display_name text DEFAULT NULL::text)
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

  -- an entry only blocks a new submission while it is still live
  -- ('checking', 'approved', 'hidden'); withdrawn/rejected entries may be re-posted.
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