-- usage_events: log every resource usage event
CREATE TABLE public.usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  event_type TEXT NOT NULL,
  model TEXT,
  units NUMERIC NOT NULL DEFAULT 0,
  unit_type TEXT NOT NULL,
  estimated_cost_vnd NUMERIC NOT NULL DEFAULT 0,
  source_function TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view usage events"
ON public.usage_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert usage events"
ON public.usage_events FOR INSERT
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can delete usage events"
ON public.usage_events FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_usage_events_created_at ON public.usage_events (created_at DESC);
CREATE INDEX idx_usage_events_service ON public.usage_events (service, created_at DESC);

-- pricing_config: editable rates
CREATE TABLE public.pricing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  model TEXT,
  unit_type TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  unit_scale NUMERIC NOT NULL DEFAULT 1,
  usd_to_vnd_rate NUMERIC NOT NULL DEFAULT 25500,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pricing"
ON public.pricing_config FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can read pricing"
ON public.pricing_config FOR SELECT
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can insert pricing"
ON public.pricing_config FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pricing"
ON public.pricing_config FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pricing"
ON public.pricing_config FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pricing_config_updated_at
BEFORE UPDATE ON public.pricing_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default pricing
INSERT INTO public.pricing_config (service, model, unit_type, price_per_unit, unit_scale, description) VALUES
('lovable_ai', 'google/gemini-2.5-flash', 'input_tokens', 0.075, 1000000, 'Gemini 2.5 Flash input ($/1M tokens)'),
('lovable_ai', 'google/gemini-2.5-flash', 'output_tokens', 0.30, 1000000, 'Gemini 2.5 Flash output ($/1M tokens)'),
('lovable_ai', 'google/gemini-2.5-pro', 'input_tokens', 1.25, 1000000, 'Gemini 2.5 Pro input ($/1M tokens)'),
('lovable_ai', 'google/gemini-2.5-pro', 'output_tokens', 5.00, 1000000, 'Gemini 2.5 Pro output ($/1M tokens)'),
('lovable_ai', 'google/gemini-2.5-flash-lite', 'input_tokens', 0.0375, 1000000, 'Gemini Flash Lite input ($/1M tokens)'),
('lovable_ai', 'google/gemini-2.5-flash-lite', 'output_tokens', 0.15, 1000000, 'Gemini Flash Lite output ($/1M tokens)'),
('google_tts', NULL, 'chars', 4.00, 1000000, 'Google TTS Standard ($/1M chars)'),
('supabase_storage', NULL, 'mb_month', 0.021, 1024, 'Storage ($/GB-month)'),
('supabase_db', NULL, 'mb_month', 0.125, 1024, 'Database ($/GB-month)'),
('edge_function', NULL, 'calls', 2.00, 1000000, 'Edge function invocations ($/1M calls)');