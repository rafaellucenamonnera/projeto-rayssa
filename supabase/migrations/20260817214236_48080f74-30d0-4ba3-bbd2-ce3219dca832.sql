ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_decision text,
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS gmail_processed_messages_reviewed_idx
  ON public.gmail_processed_messages (reviewed, created_at DESC);

GRANT SELECT, UPDATE ON public.gmail_processed_messages TO authenticated;
GRANT ALL ON public.gmail_processed_messages TO service_role;

DROP POLICY IF EXISTS "Admins podem revisar mensagens processadas" ON public.gmail_processed_messages;
CREATE POLICY "Admins podem revisar mensagens processadas"
  ON public.gmail_processed_messages
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));