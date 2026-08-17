
CREATE TABLE public.whatsapp_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text,
  size_bytes bigint,
  content_sha256 text NOT NULL UNIQUE,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'processado',
  message_count integer NOT NULL DEFAULT 0,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_message_at timestamptz,
  last_message_at timestamptz,
  error text,
  mode text NOT NULL DEFAULT 'triage',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_imports TO authenticated;
GRANT ALL ON public.whatsapp_imports TO service_role;
ALTER TABLE public.whatsapp_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam importacoes whatsapp"
ON public.whatsapp_imports FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.whatsapp_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.whatsapp_imports(id) ON DELETE CASCADE,
  cliente_nome text,
  cnpj text,
  cnpj_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  email text,
  telefone text,
  codigo_monnera text,
  campanhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  metas jsonb NOT NULL DEFAULT '[]'::jsonb,
  regras jsonb NOT NULL DEFAULT '[]'::jsonb,
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidences jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'triage_ok',
  matched_card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL,
  linked_card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL,
  conversation_started_at timestamptz,
  conversation_ended_at timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  reviewed boolean NOT NULL DEFAULT false,
  review_decision text,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  mode text NOT NULL DEFAULT 'triage',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_extractions_import ON public.whatsapp_extractions(import_id);
CREATE INDEX idx_whatsapp_extractions_status ON public.whatsapp_extractions(status);
CREATE INDEX idx_whatsapp_extractions_cnpj ON public.whatsapp_extractions(cnpj);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_extractions TO authenticated;
GRANT ALL ON public.whatsapp_extractions TO service_role;
ALTER TABLE public.whatsapp_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam extracoes whatsapp"
ON public.whatsapp_extractions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_whatsapp_extractions_updated_at
BEFORE UPDATE ON public.whatsapp_extractions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins leem arquivos whatsapp"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'whatsapp-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins enviam arquivos whatsapp"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-imports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins removem arquivos whatsapp"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'whatsapp-imports' AND public.has_role(auth.uid(), 'admin'));
