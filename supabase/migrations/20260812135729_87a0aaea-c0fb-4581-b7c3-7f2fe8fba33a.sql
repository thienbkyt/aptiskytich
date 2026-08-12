ALTER TABLE public.exam_reviews
  ADD COLUMN IF NOT EXISTS exam_location text,
  ADD COLUMN IF NOT EXISTS exam_session text;

CREATE OR REPLACE FUNCTION public.exam_reviews_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.exam_location := NULLIF(left(btrim(coalesce(NEW.exam_location, '')), 120), '');
  NEW.exam_session := NULLIF(left(btrim(coalesce(NEW.exam_session, '')), 120), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exam_reviews_normalize_trg ON public.exam_reviews;
CREATE TRIGGER exam_reviews_normalize_trg
BEFORE INSERT OR UPDATE ON public.exam_reviews
FOR EACH ROW EXECUTE FUNCTION public.exam_reviews_normalize();

DROP FUNCTION IF EXISTS public.list_exam_reviews();
CREATE FUNCTION public.list_exam_reviews()
 RETURNS TABLE(id uuid, exam_date date, note text, created_at timestamp with time zone, user_id uuid, author_name text, items jsonb, hidden_at timestamp with time zone, hidden_reason text, exam_location text, exam_session text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.exam_date, r.note, r.created_at, r.user_id,
         coalesce(p.display_name, 'Học viên'),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', i.id, 'skill', i.skill, 'part', i.part, 'topic', i.topic) order by i.skill, i.part)
           from public.exam_review_items i where i.review_id = r.id
         ), '[]'::jsonb),
         r.hidden_at,
         r.hidden_reason,
         r.exam_location,
         r.exam_session
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
$function$;