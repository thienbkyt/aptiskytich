create or replace function public.list_student_feedback()
returns table (
  id uuid, rating int, content text, score_image_url text,
  is_anonymous boolean, created_at timestamptz,
  author_name text, author_avatar text, is_mine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.rating, f.content, f.score_image_url, f.is_anonymous, f.created_at,
         case when f.is_anonymous then null else coalesce(p.display_name, 'Học viên') end,
         case when f.is_anonymous then null else p.avatar_url end,
         (f.user_id = auth.uid())
  from public.student_feedback f
  left join public.profiles p on p.user_id = f.user_id
  where f.is_approved = true
  order by f.created_at desc
  limit 500
$$;
revoke all on function public.list_student_feedback() from public;
grant execute on function public.list_student_feedback() to anon, authenticated;

create or replace function public.list_exam_reviews()
returns table (
  id uuid, exam_date date, note text, created_at timestamptz,
  user_id uuid, author_name text, items jsonb
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
         ), '[]'::jsonb)
  from public.exam_reviews r
  left join public.profiles p on p.user_id = r.user_id
  where auth.uid() is not null
  order by r.exam_date desc, r.created_at desc
  limit 500
$$;
revoke all on function public.list_exam_reviews() from public;
grant execute on function public.list_exam_reviews() to authenticated;