
-- notification_reads
DROP POLICY IF EXISTS "Users delete own reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users insert own reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users view own reads" ON public.notification_reads;
CREATE POLICY "Users delete own reads" ON public.notification_reads FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users insert own reads" ON public.notification_reads FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users view own reads" ON public.notification_reads FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "View active notifications or admin sees all" ON public.notifications;
CREATE POLICY "Admins can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (has_role((SELECT auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "View active notifications or admin sees all" ON public.notifications FOR SELECT TO authenticated USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR ((is_active = true) AND ((target_user_id IS NULL) OR (target_user_id = (SELECT auth.uid())))));

-- test_results
DROP POLICY IF EXISTS "Users can insert own results" ON public.test_results;
DROP POLICY IF EXISTS "Users can view own results" ON public.test_results;
CREATE POLICY "Users can insert own results" ON public.test_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own results" ON public.test_results FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_answers
DROP POLICY IF EXISTS "Users can insert own answers" ON public.user_answers;
DROP POLICY IF EXISTS "Users can view own answers" ON public.user_answers;
CREATE POLICY "Users can insert own answers" ON public.user_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own answers" ON public.user_answers FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- practice_history
DROP POLICY IF EXISTS "Users can insert own practice" ON public.practice_history;
DROP POLICY IF EXISTS "Users can view own practice" ON public.practice_history;
CREATE POLICY "Users can insert own practice" ON public.practice_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own practice" ON public.practice_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- exam_question_results
DROP POLICY IF EXISTS "Users can insert own question results" ON public.exam_question_results;
DROP POLICY IF EXISTS "Users can view own question results" ON public.exam_question_results;
CREATE POLICY "Users can insert own question results" ON public.exam_question_results FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can view own question results" ON public.exam_question_results FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- exam_gradings
DROP POLICY IF EXISTS "Admins can read all exam gradings" ON public.exam_gradings;
DROP POLICY IF EXISTS "Users can insert own gradings" ON public.exam_gradings;
DROP POLICY IF EXISTS "Users can view own gradings" ON public.exam_gradings;
CREATE POLICY "Admins can read all exam gradings" ON public.exam_gradings FOR SELECT TO authenticated USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Users can insert own gradings" ON public.exam_gradings FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can view own gradings" ON public.exam_gradings FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- speaking_recordings
DROP POLICY IF EXISTS "Users can delete own recordings" ON public.speaking_recordings;
DROP POLICY IF EXISTS "Users can insert own recordings" ON public.speaking_recordings;
DROP POLICY IF EXISTS "Users can view own recordings" ON public.speaking_recordings;
CREATE POLICY "Users can delete own recordings" ON public.speaking_recordings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recordings" ON public.speaking_recordings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own recordings" ON public.speaking_recordings FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_devices
DROP POLICY IF EXISTS "own devices delete" ON public.user_devices;
DROP POLICY IF EXISTS "own devices insert" ON public.user_devices;
DROP POLICY IF EXISTS "own devices select" ON public.user_devices;
DROP POLICY IF EXISTS "own devices update" ON public.user_devices;
CREATE POLICY "own devices delete" ON public.user_devices FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own devices insert" ON public.user_devices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own devices select" ON public.user_devices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own devices update" ON public.user_devices FOR UPDATE TO authenticated USING (auth.uid() = user_id);
