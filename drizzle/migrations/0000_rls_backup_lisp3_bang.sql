ALTER TABLE public.backup_lisp3_bang_20260919 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read backup_lisp3_bang_20260919" ON public.backup_lisp3_bang_20260919;
CREATE POLICY "Admins can read backup_lisp3_bang_20260919"
ON public.backup_lisp3_bang_20260919
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.backup_lisp3_bang_20260919 FROM anon;