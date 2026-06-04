
ALTER TABLE public.test_results
  ADD COLUMN IF NOT EXISTS exam_set_id UUID,
  ADD COLUMN IF NOT EXISTS time_spent INTEGER;

CREATE INDEX IF NOT EXISTS idx_test_results_user_exam_set
  ON public.test_results(user_id, exam_set_id);

CREATE TABLE IF NOT EXISTS public.exam_question_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  test_result_id UUID,
  exam_question_id UUID NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  skill TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_question_results TO authenticated;
GRANT ALL ON public.exam_question_results TO service_role;

ALTER TABLE public.exam_question_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own question results"
  ON public.exam_question_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own question results"
  ON public.exam_question_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_eqr_user ON public.exam_question_results(user_id);
CREATE INDEX IF NOT EXISTS idx_eqr_test_result ON public.exam_question_results(test_result_id);

CREATE TABLE IF NOT EXISTS public.speaking_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exam_set_id UUID,
  part TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_recordings TO authenticated;
GRANT ALL ON public.speaking_recordings TO service_role;

ALTER TABLE public.speaking_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recordings"
  ON public.speaking_recordings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recordings"
  ON public.speaking_recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings"
  ON public.speaking_recordings FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_speaking_recordings_user
  ON public.speaking_recordings(user_id, exam_set_id);
