REVOKE INSERT, UPDATE, DELETE ON public.voucher_redemptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ai_credit_grants FROM authenticated;
REVOKE ALL ON public.voucher_codes FROM anon;
REVOKE ALL ON public.voucher_redemptions FROM anon;
REVOKE ALL ON public.ai_credit_grants FROM anon;
GRANT ALL ON public.voucher_codes, public.voucher_redemptions, public.ai_credit_grants TO service_role;