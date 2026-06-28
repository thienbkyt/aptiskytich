SELECT cron.schedule('cleanup-cron-history','0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days'$$);

SELECT cron.schedule('cleanup-http-response','15 3 * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '1 day'$$);

DELETE FROM net._http_response WHERE created < now() - interval '1 day';
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days';