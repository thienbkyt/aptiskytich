ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voucher_code text;
CREATE INDEX IF NOT EXISTS payments_voucher_pending_idx
  ON public.payments (status, voucher_code) WHERE voucher_code IS NOT NULL;