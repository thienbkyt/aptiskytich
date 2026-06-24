-- 1) user_subscriptions
CREATE TABLE public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  pro_until timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own or admin" ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin insert" ON public.user_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update" ON public.user_subscriptions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete" ON public.user_subscriptions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_subscriptions_updated
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) app_settings singleton
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  promo_free_all boolean NOT NULL DEFAULT false,
  promo_label text,
  promo_from timestamptz,
  promo_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select all authenticated" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin update" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id, promo_free_all) VALUES (1, false);

-- 3) feature_flags
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  label text,
  required_tier text NOT NULL DEFAULT 'free' CHECK (required_tier IN ('free','pro')),
  free_quota int,
  quota_period text CHECK (quota_period IN ('day','month') OR quota_period IS NULL),
  enabled boolean NOT NULL DEFAULT true,
  note text,
  sort_order int,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select all authenticated" ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin insert" ON public.feature_flags
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update" ON public.feature_flags
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete" ON public.feature_flags
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_feature_flags_updated
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.feature_flags (key, label, required_tier, free_quota, quota_period, enabled, note, sort_order) VALUES
  ('exam_bank', 'Kho đề', 'pro', 2, NULL, true, 'free 2 đề/kỹ năng', 10),
  ('full_part', 'Luyện Full Part', 'pro', 2, NULL, true, NULL, 20),
  ('marathon', 'Marathon', 'pro', 2, NULL, true, NULL, 30),
  ('full_test', 'Thi thử Full Test', 'pro', 2, NULL, true, NULL, 40),
  ('ai_grading_writing', 'Chấm AI Writing', 'pro', 3, 'month', true, NULL, 50),
  ('ai_grading_speaking', 'Chấm AI Speaking', 'pro', 3, 'month', true, NULL, 60),
  ('ai_coach', 'AI Coach', 'free', NULL, NULL, false, 'đang tạm ẩn', 70),
  ('sample_answers', 'Bài viết/nói mẫu', 'free', NULL, NULL, true, NULL, 80),
  ('translate_sentence', 'Dịch cả câu', 'free', NULL, NULL, true, NULL, 90),
  ('highlight_key', 'Highlight đoạn key', 'free', NULL, NULL, true, NULL, 100);

-- 4) Functions
CREATE OR REPLACE FUNCTION public.promo_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT promo_free_all
       AND (promo_from IS NULL OR now() >= promo_from)
       AND (promo_until IS NULL OR now() <= promo_until)
     FROM public.app_settings WHERE id = 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pro(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.promo_active()
    OR EXISTS (
      SELECT 1 FROM public.user_subscriptions
       WHERE user_id = p_uid
         AND plan = 'pro'
         AND (pro_until IS NULL OR pro_until > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_pro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_pro(auth.uid());
$$;