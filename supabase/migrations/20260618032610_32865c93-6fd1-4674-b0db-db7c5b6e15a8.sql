
CREATE TABLE public.writing_question_gradings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_result_id uuid REFERENCES public.test_results(id) ON DELETE CASCADE,
  exam_set_id uuid,
  part text NOT NULL,
  item_index int NOT NULL DEFAULT 0,
  max_points numeric NOT NULL DEFAULT 0,
  part_score numeric NOT NULL DEFAULT 0,
  grammar_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  spelling_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.writing_question_gradings TO authenticated;
GRANT ALL ON public.writing_question_gradings TO service_role;

ALTER TABLE public.writing_question_gradings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own writing gradings"
  ON public.writing_question_gradings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own writing gradings"
  ON public.writing_question_gradings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own writing gradings"
  ON public.writing_question_gradings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own writing gradings"
  ON public.writing_question_gradings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_writing_question_gradings_user ON public.writing_question_gradings(user_id, created_at DESC);
CREATE INDEX idx_writing_question_gradings_test_result ON public.writing_question_gradings(test_result_id);
