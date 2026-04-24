
-- Tối ưu chi phí: chạy cron mỗi 30 giây thay vì 5 giây (giảm 6 lần invoke)
-- Auth email vẫn về trong 30 giây — trải nghiệm chấp nhận được
DO $$
DECLARE
  job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'process-email-queue';
  IF job_id IS NOT NULL THEN
    PERFORM cron.alter_job(job_id, schedule := '30 seconds');
  END IF;
END $$;

-- Tăng batch size để xử lý nhiều email/lần invoke (giảm số lần invoke)
UPDATE public.email_send_state SET batch_size = 20, send_delay_ms = 100 WHERE id = 1;
