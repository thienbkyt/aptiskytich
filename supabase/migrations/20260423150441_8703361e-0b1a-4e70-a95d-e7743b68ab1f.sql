
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-cache', 'tts-cache', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read tts-cache"
ON storage.objects FOR SELECT
USING (bucket_id = 'tts-cache');

CREATE POLICY "Service role write tts-cache"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tts-cache');

CREATE POLICY "Service role update tts-cache"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tts-cache');
