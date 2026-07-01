CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_set_id ON public.exam_questions (exam_set_id);
CREATE INDEX IF NOT EXISTS idx_exam_sets_skill_published ON public.exam_sets (skill, is_published);