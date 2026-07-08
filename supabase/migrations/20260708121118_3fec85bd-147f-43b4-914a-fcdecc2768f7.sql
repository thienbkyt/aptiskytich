UPDATE public.blog_posts
SET cover_image_url = 'covers/' || slug || '.webp'
WHERE cover_image_url = 'covers/' || slug || '.png';
