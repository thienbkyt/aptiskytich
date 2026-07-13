CREATE TABLE public.writing_skill_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_result_id uuid REFERENCES public.test_results(id) ON DELETE SET NULL,
  exam_set_id uuid REFERENCES public.exam_sets(id) ON DELETE SET NULL,
  full_test_session_id text,
  parts jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_total numeric NOT NULL DEFAULT 0,
  scale50 integer NOT NULL DEFAULT 0,
  cefr text NOT NULL DEFAULT 'A0',
  grey_zone boolean NOT NULL DEFAULT false,
  flag_review boolean NOT NULL DEFAULT false,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.writing_skill_results TO authenticated;
GRANT ALL ON public.writing_skill_results TO service_role;

ALTER TABLE public.writing_skill_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own writing skill results"
  ON public.writing_skill_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can insert their own writing skill results"
  ON public.writing_skill_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own writing skill results"
  ON public.writing_skill_results FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own writing skill results"
  ON public.writing_skill_results FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX writing_skill_results_user_idx ON public.writing_skill_results(user_id, created_at DESC);
CREATE INDEX writing_skill_results_exam_set_idx ON public.writing_skill_results(exam_set_id);
CREATE INDEX writing_skill_results_test_result_idx ON public.writing_skill_results(test_result_id);

CREATE TRIGGER update_writing_skill_results_updated_at
  BEFORE UPDATE ON public.writing_skill_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();