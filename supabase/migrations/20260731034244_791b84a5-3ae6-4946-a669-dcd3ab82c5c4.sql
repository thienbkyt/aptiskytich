-- 1) Prevent score tampering on test_results from client updates
CREATE OR REPLACE FUNCTION public.guard_test_results_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted paths: service_role, admins, or official grading RPCs that set the flag
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR COALESCE(current_setting('app.allow_score_update', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Client updates may only touch review_snapshot / grade_payload
  NEW.user_id         := OLD.user_id;
  NEW.score           := OLD.score;
  NEW.total           := OLD.total;
  NEW.level           := OLD.level;
  NEW.correct_answers := OLD.correct_answers;
  NEW.skill_scores    := OLD.skill_scores;
  NEW.exam_set_id     := OLD.exam_set_id;
  NEW.full_test_id    := OLD.full_test_id;
  NEW.full_test_session_id := OLD.full_test_session_id;
  NEW.test_id         := OLD.test_id;
  NEW.time_spent      := OLD.time_spent;
  NEW.created_at      := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_test_results_update_trg ON public.test_results;
CREATE TRIGGER guard_test_results_update_trg
BEFORE UPDATE ON public.test_results
FOR EACH ROW EXECUTE FUNCTION public.guard_test_results_update();

-- Official grading RPC keeps working (validated, owner-scoped)
CREATE OR REPLACE FUNCTION public.finalize_skill_test_result(p_test_result_id uuid, p_score numeric DEFAULT NULL::numeric, p_total numeric DEFAULT NULL::numeric, p_level text DEFAULT NULL::text, p_correct_answers numeric DEFAULT NULL::numeric, p_review_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.test_results WHERE id = p_test_result_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_owner <> auth.uid() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM set_config('app.allow_score_update', 'on', true);

  UPDATE public.test_results
     SET score           = COALESCE(p_score,           score),
         total           = COALESCE(p_total,           total),
         level           = COALESCE(p_level,           level),
         correct_answers = COALESCE(p_correct_answers, correct_answers),
         review_snapshot = COALESCE(p_review_snapshot, review_snapshot)
   WHERE id = p_test_result_id;

  PERFORM set_config('app.allow_score_update', 'off', true);
END;
$function$;

-- 2) Tighten anonymous visit logging throttle
CREATE OR REPLACE FUNCTION public.throttle_site_visits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
  minute_count integer;
  global_count integer;
BEGIN
  SELECT count(*) INTO minute_count
  FROM public.site_visits
  WHERE visitor_id = NEW.visitor_id
    AND created_at > now() - interval '1 minute';
  IF minute_count >= 5 THEN
    RAISE EXCEPTION 'Too many visit events';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.site_visits
  WHERE visitor_id = NEW.visitor_id
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Too many visit events';
  END IF;

  SELECT count(*) INTO global_count
  FROM public.site_visits
  WHERE created_at > now() - interval '1 minute';
  IF global_count >= 120 THEN
    RAISE EXCEPTION 'Visit logging temporarily throttled';
  END IF;

  NEW.created_at := now();
  RETURN NEW;
END;
$$;