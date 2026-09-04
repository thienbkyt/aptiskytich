CREATE TABLE IF NOT EXISTS public.internal_service_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_service_tokens TO service_role;
ALTER TABLE public.internal_service_tokens ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (edge functions) and SECURITY
-- DEFINER database functions may read these tokens.

INSERT INTO public.internal_service_tokens (name, token)
VALUES ('email_bridge', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_email(p_channel text, p_payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_token text;
  v_to text;
  v_subject text;
  v_html text;
  v_text text;
  v_label text;
  v_msgid text;
  v_idem text;
  v_req_id bigint;
BEGIN
  v_to := lower(btrim(coalesce(p_payload->>'to', '')));
  v_subject := btrim(coalesce(p_payload->>'subject', ''));
  v_html := coalesce(p_payload->>'html', '');
  v_text := coalesce(nullif(btrim(coalesce(p_payload->>'text','')), ''), v_subject);
  v_label := coalesce(nullif(btrim(coalesce(p_payload->>'label','')), ''), 'system');
  v_msgid := nullif(btrim(coalesce(p_payload->>'message_id','')), '');
  v_idem := coalesce(nullif(btrim(coalesce(p_payload->>'idempotency_key','')), ''), v_msgid, gen_random_uuid()::text);

  IF v_to = '' THEN
    RAISE EXCEPTION 'enqueue_email: missing recipient';
  END IF;
  IF v_subject = '' OR v_html = '' THEN
    RAISE EXCEPTION 'enqueue_email: missing subject or html';
  END IF;

  SELECT token INTO v_token
  FROM public.internal_service_tokens
  WHERE name = 'email_bridge';

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'enqueue_email: internal email bridge token missing';
  END IF;

  SELECT net.http_post(
    url := 'https://bacoamhbatqpxatrrflz.supabase.co/functions/v1/send-app-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', v_token
    ),
    body := jsonb_build_object(
      'to', v_to,
      'subject', v_subject,
      'html', v_html,
      'text', v_text,
      'label', v_label,
      'message_id', v_msgid,
      'idempotency_key', v_idem
    ),
    timeout_milliseconds := 15000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;