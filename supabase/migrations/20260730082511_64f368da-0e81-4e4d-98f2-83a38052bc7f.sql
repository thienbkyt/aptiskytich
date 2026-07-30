ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS plan_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_daily_cap integer DEFAULT NULL;