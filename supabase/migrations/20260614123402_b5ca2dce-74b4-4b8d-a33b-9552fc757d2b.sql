CREATE TABLE public.question_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_question_id uuid,
  exam_set_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  skill text NOT NULL,
  part_type text,
  question_number int,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.question_reports TO authenticated;
GRANT SELECT, UPDATE ON public.question_reports TO authenticated;
GRANT ALL ON public.question_reports TO service_role;

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own reports"
ON public.question_reports
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all reports"
ON public.question_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
ON public.question_reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));