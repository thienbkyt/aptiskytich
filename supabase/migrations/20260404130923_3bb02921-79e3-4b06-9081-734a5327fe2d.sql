-- System vocabulary sets (admin-managed, public readable)
CREATE TABLE public.system_vocab_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name TEXT NOT NULL DEFAULT 'APTIS',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_vocab_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published vocab sets"
  ON public.system_vocab_sets FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert vocab sets"
  ON public.system_vocab_sets FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vocab sets"
  ON public.system_vocab_sets FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vocab sets"
  ON public.system_vocab_sets FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_system_vocab_sets_updated_at
  BEFORE UPDATE ON public.system_vocab_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Words within each set
CREATE TABLE public.system_vocab_words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vocab_set_id UUID NOT NULL REFERENCES public.system_vocab_sets(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  phonetic TEXT DEFAULT '',
  meaning TEXT DEFAULT '',
  example_en TEXT DEFAULT '',
  example_vi TEXT DEFAULT '',
  word_family JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_vocab_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vocab words"
  ON public.system_vocab_words FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert vocab words"
  ON public.system_vocab_words FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vocab words"
  ON public.system_vocab_words FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vocab words"
  ON public.system_vocab_words FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_system_vocab_words_set_id ON public.system_vocab_words(vocab_set_id);
CREATE INDEX idx_system_vocab_words_order ON public.system_vocab_words(vocab_set_id, order_index);