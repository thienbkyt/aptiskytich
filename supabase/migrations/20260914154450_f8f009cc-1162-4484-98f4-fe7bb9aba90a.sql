SELECT net.http_post(
  url := 'https://bacoamhbatqpxatrrflz.supabase.co/functions/v1/cleanup-old-recordings',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'grading_cron_secret')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 300000
);