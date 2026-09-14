SELECT net.http_post(
  url := 'https://bacoamhbatqpxatrrflz.supabase.co/functions/v1/cleanup-old-recordings',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhY29hbWhiYXRxcHhhdHJyZmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTgyODgsImV4cCI6MjA4ODY5NDI4OH0.BcFLY1mFlFxCK7E0E89iLlh4am3mEXkbYZaFJ4O_mpw',
    'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'grading_cron_secret')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 300000
);