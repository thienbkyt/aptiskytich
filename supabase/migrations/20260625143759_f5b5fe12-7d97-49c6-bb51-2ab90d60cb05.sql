CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_key text,
  tier text,
  amount_vnd integer NOT NULL,
  order_code bigint NOT NULL UNIQUE,
  gateway text NOT NULL DEFAULT 'payos',
  status text NOT NULL DEFAULT 'pending',
  payos_link_id text,
  checkout_url text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_order_code ON public.payments(order_code);
