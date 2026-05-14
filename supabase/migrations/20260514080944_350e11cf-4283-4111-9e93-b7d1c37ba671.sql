CREATE TABLE public.cost_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month DATE NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cost records"
ON public.cost_records FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert cost records"
ON public.cost_records FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update cost records"
ON public.cost_records FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete cost records"
ON public.cost_records FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cost_records_month ON public.cost_records (month);

CREATE TRIGGER update_cost_records_updated_at
BEFORE UPDATE ON public.cost_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();