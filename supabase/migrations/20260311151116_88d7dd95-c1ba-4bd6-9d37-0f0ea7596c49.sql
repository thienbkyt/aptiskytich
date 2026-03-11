
-- Add audio_url column to questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT NULL;

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read audio files
CREATE POLICY "Anyone can read audio" ON storage.objects FOR SELECT USING (bucket_id = 'audio');

-- Allow admins to upload audio files
CREATE POLICY "Admins can upload audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete audio files
CREATE POLICY "Admins can delete audio" ON storage.objects FOR DELETE USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));
