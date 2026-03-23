
-- exam_sets table
CREATE TABLE public.exam_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'general',
  skill TEXT NOT NULL,
  part TEXT NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 30,
  description TEXT DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- exam_questions table
CREATE TABLE public.exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_set_id UUID NOT NULL REFERENCES public.exam_sets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL DEFAULT '',
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer INTEGER DEFAULT 0,
  explanation TEXT DEFAULT '',
  audio_url TEXT DEFAULT NULL,
  image_url TEXT DEFAULT NULL,
  response_time INTEGER DEFAULT NULL,
  extra_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exam_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read
CREATE POLICY "Anyone can read exam_sets" ON public.exam_sets FOR SELECT USING (true);
CREATE POLICY "Anyone can read exam_questions" ON public.exam_questions FOR SELECT USING (true);

-- RLS: Admins can manage
CREATE POLICY "Admins can insert exam_sets" ON public.exam_sets FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update exam_sets" ON public.exam_sets FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete exam_sets" ON public.exam_sets FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert exam_questions" ON public.exam_questions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update exam_questions" ON public.exam_questions FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete exam_questions" ON public.exam_questions FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_exam_sets_updated_at BEFORE UPDATE ON public.exam_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exam_questions_updated_at BEFORE UPDATE ON public.exam_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for exam images
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-images', 'exam-images', true);

-- Storage RLS for exam-images
CREATE POLICY "Anyone can read exam images" ON storage.objects FOR SELECT USING (bucket_id = 'exam-images');
CREATE POLICY "Admins can upload exam images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exam-images' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete exam images" ON storage.objects FOR DELETE USING (bucket_id = 'exam-images' AND has_role(auth.uid(), 'admin'));
