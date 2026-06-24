
CREATE TABLE public.pricing_plans (
  key text PRIMARY KEY,
  label text NOT NULL,
  duration_days int NULL,
  price_vnd int NOT NULL,
  active boolean NOT NULL DEFAULT true,
  highlight boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  note text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pricing_plans TO anon, authenticated;
GRANT ALL ON public.pricing_plans TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.pricing_plans TO authenticated;

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_plans select all" ON public.pricing_plans FOR SELECT USING (true);
CREATE POLICY "pricing_plans admin insert" ON public.pricing_plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pricing_plans admin update" ON public.pricing_plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pricing_plans admin delete" ON public.pricing_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER pricing_plans_updated_at BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_plans (key,label,duration_days,price_vnd,active,highlight,sort_order) VALUES
  ('day','1 ngày',1,25000,true,false,1),
  ('week','1 tuần',7,89000,true,false,2),
  ('month','1 tháng',30,199000,true,true,3),
  ('lifetime','Trọn đời',NULL,349000,true,true,4);
