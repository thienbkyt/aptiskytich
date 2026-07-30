select cron.schedule(
  'sweep-ungraded-writing-every-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://bacoamhbatqpxatrrflz.supabase.co/functions/v1/sweep-ungraded-writing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);