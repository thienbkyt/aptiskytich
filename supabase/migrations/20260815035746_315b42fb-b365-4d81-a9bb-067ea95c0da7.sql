-- Enable RLS on the backup table that had it disabled
ALTER TABLE public.backup_lp2_upgrade_20260814 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_lp2_upgrade_20260814 FORCE ROW LEVEL SECURITY;

ALTER TABLE public.backup_rp5_trung_20260810 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_key14 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_rathi_1308 ENABLE ROW LEVEL SECURITY;

-- Remove any Data API privileges for client roles on leftover backup/temp tables
REVOKE ALL ON public.backup_lp2_upgrade_20260814 FROM anon, authenticated;
REVOKE ALL ON public.backup_rp5_trung_20260810 FROM anon, authenticated;
REVOKE ALL ON public.tmp_key14 FROM anon, authenticated;
REVOKE ALL ON public.tmp_rathi_1308 FROM anon, authenticated;

GRANT ALL ON public.backup_lp2_upgrade_20260814 TO service_role;
GRANT ALL ON public.backup_rp5_trung_20260810 TO service_role;
GRANT ALL ON public.tmp_key14 TO service_role;
GRANT ALL ON public.tmp_rathi_1308 TO service_role;

-- Explicit admin-only read policies (defence in depth; writes remain denied for all client roles)
DROP POLICY IF EXISTS "Admins can read backup_lp2_upgrade_20260814" ON public.backup_lp2_upgrade_20260814;
CREATE POLICY "Admins can read backup_lp2_upgrade_20260814"
ON public.backup_lp2_upgrade_20260814 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read backup_rp5_trung_20260810" ON public.backup_rp5_trung_20260810;
CREATE POLICY "Admins can read backup_rp5_trung_20260810"
ON public.backup_rp5_trung_20260810 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read tmp_key14" ON public.tmp_key14;
CREATE POLICY "Admins can read tmp_key14"
ON public.tmp_key14 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read tmp_rathi_1308" ON public.tmp_rathi_1308;
CREATE POLICY "Admins can read tmp_rathi_1308"
ON public.tmp_rathi_1308 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));