-- Column-level hardening: hide internal author user IDs from client roles.
REVOKE SELECT (author_id) ON public.blog_posts FROM anon;
REVOKE SELECT (author_id) ON public.blog_posts FROM authenticated;
-- Keep all other columns readable exactly as before.
GRANT SELECT (id, title, slug, excerpt, content, cover_image_url, category, tags, status, published_at, seo_title, seo_description, created_at, updated_at) ON public.blog_posts TO anon;
GRANT SELECT (id, title, slug, excerpt, content, cover_image_url, category, tags, status, published_at, seo_title, seo_description, created_at, updated_at) ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;