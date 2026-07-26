CREATE TABLE public.score_backfill_backup_2026_07 (
  id uuid PRIMARY KEY,
  old_score numeric,
  old_total numeric,
  old_level text,
  old_review_snapshot jsonb,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.score_backfill_backup_2026_07 TO service_role;

ALTER TABLE public.score_backfill_backup_2026_07 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read score backfill backup"
ON public.score_backfill_backup_2026_07
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));