
CREATE TABLE public.vocab_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  word TEXT NOT NULL,
  vocab_set_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, word, vocab_set_id)
);

ALTER TABLE public.vocab_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vocab items" ON public.vocab_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocab items" ON public.vocab_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocab items" ON public.vocab_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocab items" ON public.vocab_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
