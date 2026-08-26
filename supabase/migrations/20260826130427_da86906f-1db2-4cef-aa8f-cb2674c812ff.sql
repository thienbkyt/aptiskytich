ALTER TABLE public.trash_images_20260826 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trash_images_20260826 FROM anon, authenticated;
GRANT ALL ON public.trash_images_20260826 TO service_role;
CREATE POLICY "Admins manage trash images list" ON public.trash_images_20260826
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));