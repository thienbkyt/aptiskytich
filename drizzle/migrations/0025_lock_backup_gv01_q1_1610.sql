-- Security: backup table was readable/writable by anyone (RLS disabled).
-- Lock it down the same way as the other backup_* tables: RLS on, no anon/authenticated access,
-- service_role keeps full access for admin/maintenance jobs. Data is untouched.
ALTER TABLE public.backup_gv01_q1_1610 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_gv01_q1_1610 FROM anon;
REVOKE ALL ON public.backup_gv01_q1_1610 FROM authenticated;
GRANT ALL ON public.backup_gv01_q1_1610 TO service_role;