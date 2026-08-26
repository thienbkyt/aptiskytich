DO $$
DECLARE
  t text;
BEGIN
  -- 1) trash_audio_20260826: enable RLS + admin-only policy
  t := 'trash_audio_20260826';
  EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'admin_all_' || t, t);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
     USING (public.has_role(auth.uid(), ''admin''))
     WITH CHECK (public.has_role(auth.uid(), ''admin''));',
    'admin_all_' || t, t
  );

  -- 2) Backup tables that already have RLS enabled but no policy: add admin-only policy
  FOREACH t IN ARRAY ARRAY[
    'backup_lp3_de03_univ_20260826',
    'backup_lp3_thutu_20260826',
    'backup_speaking_timeout_jobs_20260824',
    'backup_sub_giaupham_20260825'
  ] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'admin_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (public.has_role(auth.uid(), ''admin''))
       WITH CHECK (public.has_role(auth.uid(), ''admin''));',
      'admin_all_' || t, t
    );
  END LOOP;
END $$;