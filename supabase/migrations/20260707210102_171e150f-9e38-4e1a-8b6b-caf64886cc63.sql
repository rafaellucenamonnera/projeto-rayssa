
-- Tabela de vínculo dedicada (fluxo Painel de Treinamento -> Campanhas)
CREATE TABLE IF NOT EXISTS public.lead_training_panel_campaign_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_training_panel_campaign_links_source_unique UNIQUE (source_lead_id),
  CONSTRAINT lead_training_panel_campaign_links_campaign_unique UNIQUE (campaign_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_ltpc_links_source
  ON public.lead_training_panel_campaign_links(source_lead_id);
CREATE INDEX IF NOT EXISTS idx_ltpc_links_campaign
  ON public.lead_training_panel_campaign_links(campaign_lead_id);

GRANT SELECT ON public.lead_training_panel_campaign_links TO authenticated;
GRANT ALL ON public.lead_training_panel_campaign_links TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.lead_training_panel_campaign_links FROM authenticated;

ALTER TABLE public.lead_training_panel_campaign_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read lead_training_panel_campaign_links"
  ON public.lead_training_panel_campaign_links
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  );

-- Upsert defensivo das duas stages (não altera sort_order já existente)
INSERT INTO public.pipeline_stages_config (panel_key, value, label, sort_order)
VALUES ('painel_mrb33dc3', 'etapa_painel_mrb33dc3_2', 'Integração Finalizada', 0)
ON CONFLICT (panel_key, value) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.pipeline_stages_config (panel_key, value, label, sort_order)
VALUES ('campanhas', 'etapa_campanhas_1781056513527', 'Treinamento Painel', 0)
ON CONFLICT (panel_key, value) DO UPDATE SET label = EXCLUDED.label;
