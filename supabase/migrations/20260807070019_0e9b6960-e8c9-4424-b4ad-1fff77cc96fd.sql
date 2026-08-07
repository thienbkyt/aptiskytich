ALTER TABLE public.backup_eq_de06_16_p4_20260807 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_eq_de06_16_p4_20260807 FROM anon, authenticated;
REVOKE ALL ON public.backup_eq_de20_title_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_eq_p1_truoc_v2_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_snapshot_truoc_doi_audio_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_wsr_relink_20260805 FROM anon, authenticated;

GRANT SELECT ON public.backup_eq_de06_16_p4_20260807 TO authenticated;
GRANT SELECT ON public.backup_eq_de20_title_20260805 TO authenticated;
GRANT SELECT ON public.backup_eq_p1_truoc_v2_20260805 TO authenticated;
GRANT SELECT ON public.backup_snapshot_truoc_doi_audio_20260805 TO authenticated;
GRANT SELECT ON public.backup_wsr_relink_20260805 TO authenticated;

GRANT ALL ON public.backup_eq_de06_16_p4_20260807 TO service_role;
GRANT ALL ON public.backup_eq_de20_title_20260805 TO service_role;
GRANT ALL ON public.backup_eq_p1_truoc_v2_20260805 TO service_role;
GRANT ALL ON public.backup_snapshot_truoc_doi_audio_20260805 TO service_role;
GRANT ALL ON public.backup_wsr_relink_20260805 TO service_role;

CREATE POLICY "Admins can read backup_eq_de06_16_p4_20260807"
  ON public.backup_eq_de06_16_p4_20260807 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can read backup_eq_de20_title_20260805"
  ON public.backup_eq_de20_title_20260805 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can read backup_eq_p1_truoc_v2_20260805"
  ON public.backup_eq_p1_truoc_v2_20260805 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can read backup_snapshot_truoc_doi_audio_20260805"
  ON public.backup_snapshot_truoc_doi_audio_20260805 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can read backup_wsr_relink_20260805"
  ON public.backup_wsr_relink_20260805 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));