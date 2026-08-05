ALTER TABLE public.backup_eq_de20_title_20260805 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_eq_p1_truoc_v2_20260805 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_snapshot_truoc_doi_audio_20260805 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_wsr_relink_20260805 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_eq_de20_title_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_eq_p1_truoc_v2_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_snapshot_truoc_doi_audio_20260805 FROM anon, authenticated;
REVOKE ALL ON public.backup_wsr_relink_20260805 FROM anon, authenticated;

GRANT ALL ON public.backup_eq_de20_title_20260805 TO service_role;
GRANT ALL ON public.backup_eq_p1_truoc_v2_20260805 TO service_role;
GRANT ALL ON public.backup_snapshot_truoc_doi_audio_20260805 TO service_role;
GRANT ALL ON public.backup_wsr_relink_20260805 TO service_role;