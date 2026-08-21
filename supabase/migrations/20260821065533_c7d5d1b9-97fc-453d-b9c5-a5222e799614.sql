ALTER TABLE public.backup_key_earlyaus_20260820 ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_key_earlyaus_20260820 TO authenticated;
GRANT ALL ON public.backup_key_earlyaus_20260820 TO service_role;

-- Drop any existing permissive policies on this table before adding admin-only ones.
DROP POLICY IF EXISTS "Admin full access" ON public.backup_key_earlyaus_20260820;

CREATE POLICY "Admin full access"
  ON public.backup_key_earlyaus_20260820
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));