
-- Tests table
CREATE TABLE public.tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  skill TEXT NOT NULL,
  part TEXT NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add test_id to questions
ALTER TABLE public.questions ADD COLUMN test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE;
ALTER TABLE public.questions ADD COLUMN question_type TEXT NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE public.questions ADD COLUMN image_url TEXT;
ALTER TABLE public.questions ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;

-- Answers table
CREATE TABLE public.answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User answers table
CREATE TABLE public.user_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  test_result_id UUID NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;

-- Tests: public read, admin write
CREATE POLICY "Anyone can read tests" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Admins can insert tests" ON public.tests FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update tests" ON public.tests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete tests" ON public.tests FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Answers: public read, admin write
CREATE POLICY "Anyone can read answers" ON public.answers FOR SELECT USING (true);
CREATE POLICY "Admins can insert answers" ON public.answers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update answers" ON public.answers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete answers" ON public.answers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- User answers: users own data
CREATE POLICY "Users can insert own answers" ON public.user_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own answers" ON public.user_answers FOR SELECT USING (auth.uid() = user_id);

-- Add test_id to test_results
ALTER TABLE public.test_results ADD COLUMN test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL;
ALTER TABLE public.test_results ADD COLUMN correct_answers INTEGER NOT NULL DEFAULT 0;

-- Trigger for updated_at on tests
CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
