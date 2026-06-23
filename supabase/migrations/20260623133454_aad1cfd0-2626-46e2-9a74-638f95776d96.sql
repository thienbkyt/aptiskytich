
-- Idempotent (re)schedule of the process-email-queue cron job.
DO $$
DECLARE
  v_jobid bigint;
  v_command text;
  v_default_command text;
  v_service_key text;
BEGIN
  SELECT jobid, command INTO v_jobid, v_command
  FROM cron.job
  WHERE jobname = 'process-email-queue';

  -- Default command: call the edge function every minute using the vault-stored service role key.
  v_default_command := $cmd$
    SELECT net.http_post(
      url := 'https://bacoamhbatqpxatrrflz.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  $cmd$;

  IF v_jobid IS NOT NULL THEN
    -- Re-create with the standard 1-minute cadence, preserving the existing command body.
    PERFORM cron.unschedule(v_jobid);
    PERFORM cron.schedule('process-email-queue', '* * * * *', v_command);
  ELSE
    -- No job exists (fresh deploy / lost cron). Create it.
    -- Only attempt if the vault secret is present, otherwise the job would 401.
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;

    IF v_service_key IS NOT NULL THEN
      PERFORM cron.schedule('process-email-queue', '* * * * *', v_default_command);
    ELSE
      RAISE WARNING 'process-email-queue cron not created: vault secret email_queue_service_role_key is missing. Run setup_email_infra to provision it.';
    END IF;
  END IF;
END $$;

-- Drain any currently pending emails immediately so signup/recovery messages stuck
-- in the queue go out without waiting for the next cron tick.
DO $$
DECLARE
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF v_service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://bacoamhbatqpxatrrflz.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := '{}'::jsonb
    );
  END IF;
END $$;
