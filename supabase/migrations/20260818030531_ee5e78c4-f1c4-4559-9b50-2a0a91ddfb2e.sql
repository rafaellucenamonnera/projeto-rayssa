CREATE TABLE public.onboarding_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL,
  nome_parceiro text NOT NULL,
  codigo_parceiro text NOT NULL,
  link_material text NOT NULL,
  assunto text NOT NULL,
  destinatarios text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','erro')),
  erro_mensagem text,
  html_snapshot text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_email_sends TO authenticated;
GRANT ALL ON public.onboarding_email_sends TO service_role;

ALTER TABLE public.onboarding_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage onboarding email sends"
ON public.onboarding_email_sends FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER onboarding_email_sends_updated_at
BEFORE UPDATE ON public.onboarding_email_sends
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_onboarding_email_sends_created_at ON public.onboarding_email_sends (created_at DESC);