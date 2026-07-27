DROP TABLE IF EXISTS public.score_backfill_backup_2026_07;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_devices' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.user_devices', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "own devices update"
ON public.user_devices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);