-- Lock three stale backup tables that were created without row level security.
-- They are not referenced by any application code (only by the auto-generated
-- database type file), so no app flow depends on reading them.
-- Data is preserved; only access is closed. service_role keeps full access for
-- admin/maintenance tooling.

-- 1. backup_rename_1410_sets
REVOKE ALL ON public.backup_rename_1410_sets FROM anon, authenticated;
GRANT ALL ON public.backup_rename_1410_sets TO service_role;
ALTER TABLE public.backup_rename_1410_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backup_rename_1410_sets_service_only" ON public.backup_rename_1410_sets;
CREATE POLICY "backup_rename_1410_sets_service_only"
  ON public.backup_rename_1410_sets FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 2. backup_rename_1410_q
REVOKE ALL ON public.backup_rename_1410_q FROM anon, authenticated;
GRANT ALL ON public.backup_rename_1410_q TO service_role;
ALTER TABLE public.backup_rename_1410_q ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backup_rename_1410_q_service_only" ON public.backup_rename_1410_q;
CREATE POLICY "backup_rename_1410_q_service_only"
  ON public.backup_rename_1410_q FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 3. backup_de_thi_3009_q
REVOKE ALL ON public.backup_de_thi_3009_q FROM anon, authenticated;
GRANT ALL ON public.backup_de_thi_3009_q TO service_role;
ALTER TABLE public.backup_de_thi_3009_q ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backup_de_thi_3009_q_service_only" ON public.backup_de_thi_3009_q;
CREATE POLICY "backup_de_thi_3009_q_service_only"
  ON public.backup_de_thi_3009_q FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
