-- 1. Lock down leftover backup/temp tables (admin-only)
ALTER TABLE public.backup_rp2_singer_techfair_20260806 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_rp2_toankho_20260806 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_sample10de_20260807 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_p10 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_rp2_singer_techfair_20260806 FROM anon, authenticated;
REVOKE ALL ON public.backup_rp2_toankho_20260806 FROM anon, authenticated;
REVOKE ALL ON public.backup_sample10de_20260807 FROM anon, authenticated;
REVOKE ALL ON public.tmp_p10 FROM anon, authenticated;

GRANT SELECT ON public.backup_rp2_singer_techfair_20260806 TO authenticated;
GRANT SELECT ON public.backup_rp2_toankho_20260806 TO authenticated;
GRANT SELECT ON public.backup_sample10de_20260807 TO authenticated;
GRANT SELECT ON public.tmp_p10 TO authenticated;

GRANT ALL ON public.backup_rp2_singer_techfair_20260806 TO service_role;
GRANT ALL ON public.backup_rp2_toankho_20260806 TO service_role;
GRANT ALL ON public.backup_sample10de_20260807 TO service_role;
GRANT ALL ON public.tmp_p10 TO service_role;

CREATE POLICY "Admins can read backup rp2 singer techfair"
  ON public.backup_rp2_singer_techfair_20260806 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read backup rp2 toankho"
  ON public.backup_rp2_toankho_20260806 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read backup sample10de"
  ON public.backup_sample10de_20260807 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read tmp p10"
  ON public.tmp_p10 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Hide internal author identifiers from anonymous blog readers
REVOKE SELECT (author_id) ON public.blog_posts FROM anon;