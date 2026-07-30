ALTER TABLE public.pricing_plans ADD COLUMN IF NOT EXISTS ai_daily_cap integer;
UPDATE public.pricing_plans SET ai_daily_cap = 10 WHERE key = 'day';
UPDATE public.pricing_plans SET ai_daily_cap = 20 WHERE key = 'week';
UPDATE public.pricing_plans SET ai_daily_cap = 30 WHERE key IN ('month','quarter','half_year');
UPDATE public.pricing_plans SET ai_daily_cap = NULL WHERE key = 'lifetime';