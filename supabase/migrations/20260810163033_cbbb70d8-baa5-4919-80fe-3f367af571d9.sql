create table public.custom_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('full_test','full_part')),
  skill text,
  created_at timestamptz not null default now(),
  last_played_at timestamptz
);

create table public.custom_set_members (
  id uuid primary key default gen_random_uuid(),
  custom_set_id uuid not null references public.custom_sets(id) on delete cascade,
  exam_set_id uuid not null references public.exam_sets(id) on delete cascade,
  position int not null default 0,
  unique (custom_set_id, exam_set_id)
);

create index idx_custom_sets_user on public.custom_sets(user_id);
create index idx_custom_set_members_set on public.custom_set_members(custom_set_id);

grant select, insert, update, delete on public.custom_sets to authenticated;
grant all on public.custom_sets to service_role;
grant select, insert, update, delete on public.custom_set_members to authenticated;
grant all on public.custom_set_members to service_role;

alter table public.custom_sets enable row level security;
alter table public.custom_set_members enable row level security;

create policy "own custom sets" on public.custom_sets
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "admins read custom sets" on public.custom_sets
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "own custom set members" on public.custom_set_members
  for all to authenticated
  using (exists (select 1 from public.custom_sets s where s.id = custom_set_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.custom_sets s where s.id = custom_set_id and s.user_id = auth.uid()));

create policy "admins read custom set members" on public.custom_set_members
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.create_custom_set(
  p_title text,
  p_mode text,
  p_skill text,
  p_exam_set_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.create_custom_set(text, text, text, uuid[]) to authenticated;