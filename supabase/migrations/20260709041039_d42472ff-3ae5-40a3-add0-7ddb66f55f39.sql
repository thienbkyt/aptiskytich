
-- 1. Bootstrap RPC combining tier + subscription + unread count in a single call
CREATE OR REPLACE FUNCTION public.get_user_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tier text;
  v_sub record;
  v_unread int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('tier','free','subscription', null, 'unread_notification_count', 0);
  END IF;

  v_tier := public.user_tier(v_uid);

  SELECT tier, pro_until INTO v_sub
    FROM public.user_subscriptions
   WHERE user_id = v_uid
   LIMIT 1;

  SELECT count(*) INTO v_unread
    FROM public.notifications n
   WHERE n.is_active = true
     AND NOT EXISTS (
       SELECT 1 FROM public.notification_reads r
        WHERE r.notification_id = n.id AND r.user_id = v_uid
     );

  RETURN jsonb_build_object(
    'tier', v_tier,
    'subscription', CASE WHEN v_sub IS NULL THEN null
                         ELSE jsonb_build_object('tier', v_sub.tier, 'pro_until', v_sub.pro_until)
                    END,
    'unread_notification_count', v_unread
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_bootstrap() TO authenticated;

-- 2. Wrap auth.uid()/has_role() in subselects on hot tables so Postgres evaluates
--    them once per query instead of once per row.

-- notification_reads
DROP POLICY IF EXISTS "Users delete own reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users insert own reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users view own reads" ON public.notification_reads;
CREATE POLICY "Users view own reads" ON public.notification_reads
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users insert own reads" ON public.notification_reads
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users delete own reads" ON public.notification_reads
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- notifications (admin-write policies)
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "View active notifications or admin sees all" ON public.notifications;
CREATE POLICY "View active notifications or admin sees all" ON public.notifications
  FOR SELECT USING (is_active = true OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can update notifications" ON public.notifications
  FOR UPDATE USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can delete notifications" ON public.notifications
  FOR DELETE USING (public.has_role((SELECT auth.uid()), 'admin'));

-- user_subscriptions
DROP POLICY IF EXISTS "admin delete" ON public.user_subscriptions;
DROP POLICY IF EXISTS "admin insert" ON public.user_subscriptions;
DROP POLICY IF EXISTS "admin update" ON public.user_subscriptions;
DROP POLICY IF EXISTS "select own or admin" ON public.user_subscriptions;
CREATE POLICY "select own or admin" ON public.user_subscriptions
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "admin insert" ON public.user_subscriptions
  FOR INSERT WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "admin update" ON public.user_subscriptions
  FOR UPDATE USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "admin delete" ON public.user_subscriptions
  FOR DELETE USING (public.has_role((SELECT auth.uid()), 'admin'));

-- blog_posts (admin-write policies; public read policy already has no auth.uid)
DROP POLICY IF EXISTS "Admins can delete posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can insert posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can read all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can update posts" ON public.blog_posts;
CREATE POLICY "Admins can read all posts" ON public.blog_posts
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can insert posts" ON public.blog_posts
  FOR INSERT WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can update posts" ON public.blog_posts
  FOR UPDATE USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins can delete posts" ON public.blog_posts
  FOR DELETE USING (public.has_role((SELECT auth.uid()), 'admin'));

-- feature_usage
DROP POLICY IF EXISTS "feature_usage_insert_own" ON public.feature_usage;
DROP POLICY IF EXISTS "feature_usage_select_own" ON public.feature_usage;
CREATE POLICY "feature_usage_select_own" ON public.feature_usage
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "feature_usage_insert_own" ON public.feature_usage
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- exam_question_results
DROP POLICY IF EXISTS "Users can insert own question results" ON public.exam_question_results;
DROP POLICY IF EXISTS "Users can view own question results" ON public.exam_question_results;
CREATE POLICY "Users can view own question results" ON public.exam_question_results
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own question results" ON public.exam_question_results
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- exam_gradings
DROP POLICY IF EXISTS "Admins can read all exam gradings" ON public.exam_gradings;
DROP POLICY IF EXISTS "Users can insert own gradings" ON public.exam_gradings;
DROP POLICY IF EXISTS "Users can view own gradings" ON public.exam_gradings;
CREATE POLICY "Users can view own gradings" ON public.exam_gradings
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own gradings" ON public.exam_gradings
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Admins can read all exam gradings" ON public.exam_gradings
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));

-- 3. Ensure indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_pub ON public.blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON public.site_visits (created_at DESC);
