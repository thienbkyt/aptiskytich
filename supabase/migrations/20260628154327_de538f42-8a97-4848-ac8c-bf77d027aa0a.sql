
-- prediction_keys
CREATE TABLE public.prediction_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  title text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prediction_keys TO authenticated;
GRANT ALL ON public.prediction_keys TO service_role;
ALTER TABLE public.prediction_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read published keys" ON public.prediction_keys
  FOR SELECT TO authenticated USING (is_published = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin insert keys" ON public.prediction_keys
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update keys" ON public.prediction_keys
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete keys" ON public.prediction_keys
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_prediction_keys_updated
  BEFORE UPDATE ON public.prediction_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- prediction_items
CREATE TABLE public.prediction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.prediction_keys(id) ON DELETE CASCADE,
  exam_set_id uuid NOT NULL REFERENCES public.exam_sets(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low','backup')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prediction_items_key ON public.prediction_items(key_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prediction_items TO authenticated;
GRANT ALL ON public.prediction_items TO service_role;
ALTER TABLE public.prediction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read items of published keys" ON public.prediction_items
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR EXISTS (
      SELECT 1 FROM public.prediction_keys k WHERE k.id = key_id AND k.is_published = true
    )
  );
CREATE POLICY "admin insert items" ON public.prediction_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update items" ON public.prediction_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete items" ON public.prediction_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- feature flag
INSERT INTO public.feature_flags (key, label, required_tier, enabled)
VALUES ('prediction_key', 'Key Dự Đoán', 'premium', true)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, required_tier = EXCLUDED.required_tier, enabled = EXCLUDED.enabled;
