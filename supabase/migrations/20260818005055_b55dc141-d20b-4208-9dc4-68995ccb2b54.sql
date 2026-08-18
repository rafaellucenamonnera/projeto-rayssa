CREATE TABLE public.triage_info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('gmail','whatsapp')),
  row_id uuid NOT NULL,
  card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL,
  pendency_code text NOT NULL,
  reason text NOT NULL,
  template_key text NOT NULL,
  template_version text NOT NULL,
  subject text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  recipients_source text NOT NULL,
  thread_id text,
  gmail_message_id text,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','falhou','bloqueado_sem_destinatario')),
  attempt integer NOT NULL DEFAULT 1,
  error text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_triage_info_requests_row ON public.triage_info_requests (source, row_id, created_at DESC);
CREATE INDEX idx_triage_info_requests_pendency ON public.triage_info_requests (row_id, pendency_code, status);

GRANT SELECT ON public.triage_info_requests TO authenticated;
GRANT ALL ON public.triage_info_requests TO service_role;

ALTER TABLE public.triage_info_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver solicitacoes de informacao"
ON public.triage_info_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));