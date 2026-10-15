-- Lock three unused backup tables that had no access rules.
-- Rows are kept untouched; only access changes. No app code reads these tables.

ALTER TABLE public.backup_mountain_v3_20261005 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_de37_q4_teacher_20261006 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_l15_order_1510 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_mountain_v3_20261005 FROM anon, authenticated;
REVOKE ALL ON public.backup_de37_q4_teacher_20261006 FROM anon, authenticated;
REVOKE ALL ON public.backup_l15_order_1510 FROM anon, authenticated;

GRANT ALL ON public.backup_mountain_v3_20261005 TO service_role;
GRANT ALL ON public.backup_de37_q4_teacher_20261006 TO service_role;
GRANT ALL ON public.backup_l15_order_1510 TO service_role;