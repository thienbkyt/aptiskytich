CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  msg_id bigint;
  backoff timestamptz;
BEGIN
  BEGIN
    msg_id := pgmq.send(queue_name, payload);
  EXCEPTION WHEN undefined_table THEN
    PERFORM pgmq.create(queue_name);
    msg_id := pgmq.send(queue_name, payload);
  END;

  -- Event-driven: process the queue immediately on enqueue.
  -- Best-effort only: must NEVER block or fail the enqueue itself.
  BEGIN
    SELECT retry_after_until INTO backoff FROM public.email_send_state WHERE id = 1;
    IF backoff IS NULL OR backoff <= now() THEN
      PERFORM net.http_post(
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
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- safety-net cron will handle it
  END;

  RETURN msg_id;
END;
$function$;

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE command LIKE '%process-email-queue%' LIMIT 1),
  schedule := '* * * * *'
);