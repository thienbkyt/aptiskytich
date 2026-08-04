CREATE TABLE IF NOT EXISTS public.speaking_grading_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  part text,
  max_points numeric NOT NULL DEFAULT 0,
  part_score numeric NOT NULL DEFAULT 0,
  transcript text,
  grammar_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  pronunciation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  improved_version text,
  feedback text,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.speaking_grading_tickets TO authenticated;
GRANT ALL ON public.speaking_grading_tickets TO service_role;

ALTER TABLE public.speaking_grading_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own speaking tickets" ON public.speaking_grading_tickets;
CREATE POLICY "Users view own speaking tickets"
  ON public.speaking_grading_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sgt_user ON public.speaking_grading_tickets(user_id, created_at DESC);

ALTER TABLE public.speaking_question_gradings
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.speaking_grading_tickets(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.enforce_speaking_grading_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t public.speaking_grading_tickets;
BEGIN
  -- Server-side writers (service role / workers) have no auth.uid(); they are trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.ticket_id IS NULL THEN
    RAISE EXCEPTION 'speaking grading requires a server-issued ticket';
  END IF;

  SELECT * INTO t
  FROM public.speaking_grading_tickets
  WHERE id = NEW.ticket_id
    AND user_id = auth.uid()
    AND used_at IS NULL
  FOR UPDATE;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'invalid or already used speaking grading ticket';
  END IF;

  -- Authoritative values come from the ticket, never from the client payload.
  NEW.user_id := t.user_id;
  NEW.max_points := t.max_points;
  NEW.part_score := t.part_score;
  NEW.transcript := t.transcript;
  NEW.grammar_errors := t.grammar_errors;
  NEW.pronunciation_errors := t.pronunciation_errors;
  NEW.improved_version := t.improved_version;
  NEW.feedback := t.feedback;

  UPDATE public.speaking_grading_tickets
  SET used_at = now()
  WHERE id = t.id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_speaking_grading_ticket ON public.speaking_question_gradings;
CREATE TRIGGER trg_enforce_speaking_grading_ticket
BEFORE INSERT ON public.speaking_question_gradings
FOR EACH ROW EXECUTE FUNCTION public.enforce_speaking_grading_ticket();