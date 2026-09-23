CREATE TABLE IF NOT EXISTS public.writing_calibration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id uuid NOT NULL,
  session_id uuid,
  label text,
  part text,
  raw_old numeric,
  raw_v3 numeric,
  bands_v3 jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  error text,
  created_at timestamptz DEFAULT now(),
  done_at timestamptz
);

GRANT ALL ON TABLE public.writing_calibration TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.writing_calibration TO authenticated;

ALTER TABLE public.writing_calibration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage writing_calibration" ON public.writing_calibration;
CREATE POLICY "Admins manage writing_calibration"
ON public.writing_calibration
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS writing_calibration_status_idx
  ON public.writing_calibration (status, created_at);