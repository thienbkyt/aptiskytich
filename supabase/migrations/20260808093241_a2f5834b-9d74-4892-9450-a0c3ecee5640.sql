REVOKE SELECT ON public.blog_posts FROM anon;
GRANT SELECT (id, title, slug, excerpt, content, cover_image_url, category, tags, status, published_at, seo_title, seo_description, created_at, updated_at)
  ON public.blog_posts TO anon;