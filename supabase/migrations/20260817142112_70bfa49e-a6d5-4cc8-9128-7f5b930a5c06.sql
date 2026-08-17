CREATE TABLE public.user_goals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  aim text NOT NULL CHECK (aim IN ('B1','B2','C')),
  daily_target int NOT NULL CHECK (daily_target BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_goals TO authenticated;
GRANT ALL ON public.user_goals TO service_role;

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own goal" ON public.user_goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_goals_updated_at BEFORE UPDATE ON public.user_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security hardening: backed-up password hash table must be admin-only and fail-closed
REVOKE ALL ON public.backup_auth_pass_20260815 FROM anon, authenticated;
ALTER TABLE public.backup_auth_pass_20260815 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins only" ON public.backup_auth_pass_20260815;
CREATE POLICY "Admins only" ON public.backup_auth_pass_20260815 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));