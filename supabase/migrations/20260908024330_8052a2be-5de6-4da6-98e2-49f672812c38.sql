CREATE OR REPLACE FUNCTION public.get_user_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tier text;
  v_sub record;
  v_unread int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('uid', null, 'tier','free','subscription', null, 'unread_notification_count', 0);
  END IF;

  v_tier := public.user_tier(v_uid);

  SELECT tier, pro_until INTO v_sub
    FROM public.user_subscriptions
   WHERE user_id = v_uid
   LIMIT 1;

  SELECT count(*) INTO v_unread
    FROM public.notifications n
   WHERE n.is_active = true
     AND (n.target_user_id IS NULL OR n.target_user_id = v_uid)
     AND NOT EXISTS (
       SELECT 1 FROM public.notification_reads r
        WHERE r.notification_id = n.id AND r.user_id = v_uid
     );

  RETURN jsonb_build_object(
    'uid', v_uid,
    'tier', v_tier,
    'subscription', CASE WHEN v_sub IS NULL THEN null
                         ELSE jsonb_build_object('tier', v_sub.tier, 'pro_until', v_sub.pro_until)
                    END,
    'unread_notification_count', v_unread
  );
END;
$function$;