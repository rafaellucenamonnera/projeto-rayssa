CREATE TABLE public.pipeline_stages_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_stages_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pipeline stages config"
  ON public.pipeline_stages_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage pipeline stages config"
  ON public.pipeline_stages_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pipeline_stages_config_updated_at
  BEFORE UPDATE ON public.pipeline_stages_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pipeline_stages_config (value, label, sort_order) VALUES
  ('novo_lead', 'Lead', 1),
  ('contato_realizado', 'Contato Realizado', 2),
  ('reuniao_agendada', 'Reunião Agendada', 3),
  ('reuniao_realizada', 'Reunião Realizada', 4),
  ('proposta_enviada', 'Proposta Enviada', 5),
  ('lead_convertido', 'Lead Convertido', 6),
  ('contrato_enviado', 'Contrato Enviado', 7),
  ('contrato_assinado', 'Contrato Assinado', 8),
  ('lead_perdido', 'Lead Perdido', 9);