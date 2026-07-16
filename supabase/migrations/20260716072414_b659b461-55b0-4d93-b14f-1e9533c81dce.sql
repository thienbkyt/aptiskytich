CREATE POLICY "Guests can submit reports"
ON public.question_reports
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);