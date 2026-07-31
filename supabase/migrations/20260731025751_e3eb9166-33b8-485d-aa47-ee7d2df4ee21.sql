CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'hoc_vien', (SELECT count(*) FROM auth.users),
    'bai_cham_ai', (SELECT count(*) FROM public.feature_usage WHERE feature_key IN ('ai_grading_writing','ai_grading_speaking')),
    'de_thi', (SELECT count(*) FROM public.exam_sets WHERE is_published)
  )
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;