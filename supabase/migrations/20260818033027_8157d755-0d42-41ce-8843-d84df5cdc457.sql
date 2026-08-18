ALTER TABLE public.onboarding_email_sends DROP CONSTRAINT IF EXISTS onboarding_email_sends_status_check;
ALTER TABLE public.onboarding_email_sends ADD CONSTRAINT onboarding_email_sends_status_check CHECK (status = ANY (ARRAY['rascunho'::text,'enviando'::text,'enviado'::text,'erro'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_email_sends_unique_sent
  ON public.onboarding_email_sends (card_id, codigo_parceiro)
  WHERE status = 'enviado';