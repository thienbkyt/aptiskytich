INSERT INTO public.pricing_config (
  service,
  model,
  unit_type,
  price_per_unit,
  unit_scale,
  usd_to_vnd_rate,
  description,
  is_active,
  effective_from
) VALUES (
  'elevenlabs_tts',
  'eleven_multilingual_v2',
  'character',
  0,
  1,
  1,
  'ElevenLabs TTS (exam voice) - placeholder price, update unit_price later',
  true,
  CURRENT_DATE
);