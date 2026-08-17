GRANT ALL ON public.backup_exam_reviews_20260817 TO service_role;
GRANT ALL ON public.backup_exam_reviews_20260817b TO service_role;
GRANT ALL ON public.backup_exam_review_items_20260817 TO service_role;
GRANT ALL ON public.backup_exam_review_items_20260817b TO service_role;

ALTER TABLE public.backup_exam_reviews_20260817 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_exam_reviews_20260817b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_exam_review_items_20260817 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_exam_review_items_20260817b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup exam reviews 20260817" ON public.backup_exam_reviews_20260817 FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert backup exam reviews 20260817" ON public.backup_exam_reviews_20260817 FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update backup exam reviews 20260817" ON public.backup_exam_reviews_20260817 FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete backup exam reviews 20260817" ON public.backup_exam_reviews_20260817 FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view backup exam reviews 20260817b" ON public.backup_exam_reviews_20260817b FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert backup exam reviews 20260817b" ON public.backup_exam_reviews_20260817b FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update backup exam reviews 20260817b" ON public.backup_exam_reviews_20260817b FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete backup exam reviews 20260817b" ON public.backup_exam_reviews_20260817b FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view backup exam review items 20260817" ON public.backup_exam_review_items_20260817 FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert backup exam review items 20260817" ON public.backup_exam_review_items_20260817 FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update backup exam review items 20260817" ON public.backup_exam_review_items_20260817 FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete backup exam review items 20260817" ON public.backup_exam_review_items_20260817 FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view backup exam review items 20260817b" ON public.backup_exam_review_items_20260817b FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert backup exam review items 20260817b" ON public.backup_exam_review_items_20260817b FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update backup exam review items 20260817b" ON public.backup_exam_review_items_20260817b FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete backup exam review items 20260817b" ON public.backup_exam_review_items_20260817b FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));