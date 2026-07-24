
CREATE TABLE public.key_notify_log (
  key_date text PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now(),
  email_count int NOT NULL DEFAULT 0
);

GRANT SELECT ON public.key_notify_log TO authenticated;
GRANT ALL ON public.key_notify_log TO service_role;

ALTER TABLE public.key_notify_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view key notify log"
  ON public.key_notify_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
