
CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  path text,
  visitor_id text
);
CREATE INDEX idx_site_visits_created_at ON public.site_visits (created_at DESC);

GRANT INSERT ON public.site_visits TO anon, authenticated;
GRANT SELECT ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visit"
  ON public.site_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view visits"
  ON public.site_visits FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
