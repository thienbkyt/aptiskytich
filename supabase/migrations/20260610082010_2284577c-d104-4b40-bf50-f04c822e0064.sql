
DO $$
DECLARE
  v_jobid bigint;
  v_command text;
BEGIN
  SELECT jobid, command INTO v_jobid, v_command
  FROM cron.job
  WHERE jobname = 'process-email-queue';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
    PERFORM cron.schedule('process-email-queue', '5 seconds', v_command);
  END IF;
END $$;

UPDATE public.email_send_state
SET auth_email_ttl_minutes = 30,
    updated_at = now()
WHERE id = 1;
