UPDATE public.pricing_plans SET ai_daily_cap = 15 WHERE key = 'week';
UPDATE public.pricing_plans SET ai_daily_cap = 20, highlight = false WHERE key = 'month';
UPDATE public.pricing_plans SET price_vnd = 349000, ai_daily_cap = 30, highlight = true WHERE key = 'quarter';
UPDATE public.pricing_plans SET price_vnd = 599000 WHERE key = 'half_year';