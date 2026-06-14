-- Add new columns for functional/bug reports
ALTER TABLE public.question_reports
  ADD COLUMN report_category text NOT NULL DEFAULT 'content',
  ADD COLUMN page_url text,
  ADD COLUMN device_info text;

-- Allow skill to be NULL for functional reports that aren't tied to a specific question/exam
ALTER TABLE public.question_reports
  ALTER COLUMN skill DROP NOT NULL;
