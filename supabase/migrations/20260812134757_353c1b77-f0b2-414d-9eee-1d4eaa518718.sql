alter table public.exam_reviews
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id),
  add column if not exists hidden_reason text;

create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role = 'admin'
  )
$$;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

drop function if exists public.list_exam_reviews();
create function public.list_exam_reviews()
returns table (
  id uuid, exam_date date, note text, created_at timestamptz,
  user_id uuid, author_name text, items jsonb, hidden_at timestamptz,
  hidden_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.exam_date, r.note, r.created_at, r.user_id,
         coalesce(p.display_name, 'Học viên'),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', i.id, 'skill', i.skill, 'part', i.part, 'topic', i.topic) order by i.skill, i.part)
           from public.exam_review_items i where i.review_id = r.id
         ), '[]'::jsonb),
         r.hidden_at,
         r.hidden_reason
  from public.exam_reviews r
  left join public.profiles p on p.user_id = r.user_id
  where auth.uid() is not null
    and (
      r.hidden_at is null
      or r.user_id = auth.uid()
      or public.is_admin(auth.uid())
    )
  order by r.exam_date desc, r.created_at desc
  limit 500
$$;
revoke all on function public.list_exam_reviews() from public;
grant execute on function public.list_exam_reviews() to authenticated;

create or replace function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Chỉ admin mới thực hiện được thao tác này';
  end if;

  if p_hidden then
    update public.exam_reviews
       set hidden_at = now(), hidden_by = auth.uid(), hidden_reason = nullif(btrim(coalesce(p_reason, '')), '')
     where id = p_review_id;
  else
    update public.exam_reviews
       set hidden_at = null, hidden_by = null, hidden_reason = null
     where id = p_review_id;
  end if;
end;
$$;
revoke all on function public.admin_set_review_hidden(uuid, boolean, text) from public;
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;

create or replace function public.admin_delete_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Chỉ admin mới thực hiện được thao tác này';
  end if;

  delete from public.exam_review_items where review_id = p_review_id;
  delete from public.exam_reviews where id = p_review_id;
end;
$$;
revoke all on function public.admin_delete_review(uuid) from public;
grant execute on function public.admin_delete_review(uuid) to authenticated;