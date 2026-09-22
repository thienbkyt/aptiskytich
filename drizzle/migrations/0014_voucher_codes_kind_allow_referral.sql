alter table public.voucher_codes drop constraint if exists voucher_codes_kind_check;

alter table public.voucher_codes add constraint voucher_codes_kind_check check (kind = any (array['standalone'::text,'checkout'::text,'referral'::text]));