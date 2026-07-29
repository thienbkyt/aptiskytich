DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  has_role((SELECT auth.uid()), 'admin'::app_role)
  AND created_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "Admins can update notifications" ON public.notifications;
CREATE POLICY "Admins can update notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));