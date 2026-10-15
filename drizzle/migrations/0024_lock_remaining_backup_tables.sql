ALTER TABLE public.backup_de_thi_1210_q ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_l_0510_q ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bak_writing_p1_samples_20261013 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_de_thi_1210_q, public.backup_l_0510_q, public.bak_writing_p1_samples_20261013 FROM anon, authenticated;