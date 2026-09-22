CREATE OR REPLACE FUNCTION public.get_showcase_by_set(
  p_exam_set_id uuid,
  p_band text,
  p_seed integer DEFAULT 0,
  p_skill text DEFAULT NULL::text,
  p_part_type text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, band text, raw_part numeric, display_name text, created_at timestamptz, preview text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH top15 AS (
    SELECT e.id, e.band, e.raw_part, e.display_name, e.created_at, e.content_text
    FROM public.showcase_entries e
    WHERE e.status = 'approved'
      AND e.exam_set_id = p_exam_set_id
      AND (p_band IS NULL OR e.band = p_band)
      AND (p_skill IS NULL OR e.skill = p_skill)
      AND (p_part_type IS NULL OR e.part_type = p_part_type)
    ORDER BY e.raw_part DESC, e.approved_at DESC NULLS LAST
    LIMIT 15
  )
  SELECT t.id, t.band, t.raw_part, t.display_name, t.created_at,
         (SELECT string_agg(l, E'\n')
            FROM (SELECT l FROM unnest(string_to_array(t.content_text, E'\n')) l LIMIT 2) s)
           AS preview
  FROM top15 t
  ORDER BY md5(t.id::text || p_seed::text)
  LIMIT 3;
$function$;

GRANT EXECUTE ON FUNCTION public.get_showcase_by_set(uuid, text, integer, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_showcase_band_counts(
  p_exam_set_id uuid,
  p_skill text,
  p_part_type text
)
RETURNS TABLE(band text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.band, count(*)
  FROM public.showcase_entries e
  WHERE e.status = 'approved'
    AND e.exam_set_id = p_exam_set_id
    AND e.skill = p_skill
    AND e.part_type = p_part_type
  GROUP BY e.band;
$function$;

GRANT EXECUTE ON FUNCTION public.get_showcase_band_counts(uuid, text, text) TO anon, authenticated;