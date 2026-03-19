
-- Table to store AI grading results for Speaking and Writing
CREATE TABLE public.exam_gradings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('speaking', 'writing')),
  part_type TEXT NOT NULL,
  overall_level TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '[]',
  mistakes JSONB NOT NULL DEFAULT '[]',
  suggestions JSONB NOT NULL DEFAULT '[]',
  transcript TEXT DEFAULT '',
  student_text TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exam_gradings ENABLE ROW LEVEL SECURITY;

-- Users can insert own gradings
CREATE POLICY "Users can insert own gradings"
ON public.exam_gradings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view own gradings
CREATE POLICY "Users can view own gradings"
ON public.exam_gradings FOR SELECT
USING (auth.uid() = user_id);
