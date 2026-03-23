
CREATE TABLE public.vocab_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vocab_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vocab lists" ON public.vocab_lists
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocab lists" ON public.vocab_lists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocab lists" ON public.vocab_lists
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocab lists" ON public.vocab_lists
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
