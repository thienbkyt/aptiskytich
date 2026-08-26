-- Secure RLS-disabled exam-content backup tables (admin-only access)
-- Consistent with the policy pattern used on other secured backup_* tables.

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'backup_lp1_chuanhoa_20260826',
    'backup_lp2_chuanhoa_20260826',
    'backup_lp3_chuanhoa_20260826',
    'backup_lp4_chuanhoa_20260826',
    'backup_qa_fix_26082026',
    'backup_sua_de_ca25_20260826'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- Service role (edge functions / admin backend) gets full access; bypasses RLS.
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    -- Authenticated admins manage rows; policy below gates to admin role.
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    -- Enable RLS.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- Drop any existing policies, then add a single admin-only policy.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'admin_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (public.has_role(auth.uid(), ''admin''))
       WITH CHECK (public.has_role(auth.uid(), ''admin''));',
      'admin_all_' || t, t
    );
  END LOOP;
END $$;