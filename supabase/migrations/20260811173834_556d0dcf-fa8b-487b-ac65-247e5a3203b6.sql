CREATE TABLE public.client_error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  context text,
  error_name text,
  error_message text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.client_error_logs TO authenticated;
GRANT ALL ON public.client_error_logs TO service_role;

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own client error logs"
ON public.client_error_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_client_error_logs_context_created
ON public.client_error_logs (context, created_at DESC);