CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read all speaking gradings" ON public.speaking_question_gradings
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read all writing gradings" ON public.writing_question_gradings
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));