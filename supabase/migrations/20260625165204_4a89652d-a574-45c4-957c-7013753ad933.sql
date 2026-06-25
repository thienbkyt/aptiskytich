
CREATE TABLE public.speaking_skill_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_result_id uuid,
  exam_set_id uuid,
  full_test_session_id uuid,
  parts jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_total numeric DEFAULT 0,
  scale50 numeric DEFAULT 0,
  cefr text,
  grey_zone boolean DEFAULT false,
  flag_review boolean DEFAULT false,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_skill_results TO authenticated;
GRANT ALL ON public.speaking_skill_results TO service_role;

ALTER TABLE public.speaking_skill_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speaking_skill_results_select_own"
  ON public.speaking_skill_results FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "speaking_skill_results_insert_own"
  ON public.speaking_skill_results FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "speaking_skill_results_update_own"
  ON public.speaking_skill_results FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "speaking_skill_results_delete_own"
  ON public.speaking_skill_results FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_speaking_skill_results_user_created
  ON public.speaking_skill_results (user_id, created_at DESC);

CREATE INDEX idx_speaking_skill_results_test_result
  ON public.speaking_skill_results (test_result_id);
