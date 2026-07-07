
-- 1. Tabela de vinculos comercial -> onboarding
CREATE TABLE IF NOT EXISTS public.lead_onboarding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  onboarding_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_onboarding_links_commercial_uk UNIQUE (commercial_lead_id),
  CONSTRAINT lead_onboarding_links_onboarding_uk UNIQUE (onboarding_lead_id)
);

GRANT SELECT ON public.lead_onboarding_links TO authenticated;
GRANT ALL    ON public.lead_onboarding_links TO service_role;

ALTER TABLE public.lead_onboarding_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/gestor podem ler vinculos" ON public.lead_onboarding_links;
CREATE POLICY "Admin/gestor podem ler vinculos"
  ON public.lead_onboarding_links
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  );

-- 2. Funcao que garante o espelho no Onboarding
CREATE OR REPLACE FUNCTION public.ensure_onboarding_card_from_contract_signed(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_panel_id   text;
  v_status     text;
  v_existing   uuid;
  v_new_id     uuid;
  v_copy_cols  text[] := ARRAY[
    'cidade','cnpj','campaign_status_current','campaign_status_current_month',
    'campaign_status_previous','campaign_status_previous_month','categoria',
    'consultor','cpf_responsavel','csat','csat_current','csat_current_month',
    'csat_direction','csat_previous','csat_previous_month','csat_variation',
    'data_contrato_assinado','descricao_necessidade','email_responsavel',
    'endereco_cep','endereco_estado','endereco_numero','endereco_rua',
    'erp_utilizado','health_status','impact_level','juros_recebidos',
    'multas_recebidas','nome_fantasia','nome_responsavel','parceiro_id',
    'percentual_consultor','qtd_parcelas','quantidade_funcionarios',
    'quantidade_lojas','razao_social','receita_taxa_boleto',
    'receita_transferencias','responsavel_comercial_email',
    'responsavel_comercial_nome','responsavel_comercial_telefone',
    'responsavel_rh_email','responsavel_rh_nome','responsavel_rh_telefone',
    'responsavel_tecnico_email','responsavel_tecnico_nome',
    'responsavel_tecnico_telefone','responsible_user_id','revenue_breakdown',
    'revenue_current','revenue_current_month','revenue_previous',
    'revenue_previous_month','revenue_total','revenue_variation','status',
    'telefone_responsavel','valor_campanhas','valor_campanhas_anterior',
    'valor_mensalidade','valor_mensalidade_anterior','valor_pagamento',
    'valor_pagamento_anterior'
  ];
  -- overrides: (col_name, sql_expression)
  v_overrides text[][] := ARRAY[
    ['panel_id',                  $$'onboarding'::text$$],
    ['status_lead',               $$'etapa_onboarding_1777497467069'::public.lead_status$$],
    ['origem',                    $$'copia_automatica_comercial'::text$$],
    ['completion_token',          $$NULL$$],
    ['dados_completos',           $$true$$],
    ['dados_contrato_completos',  $$true$$],
    ['parcelas_pagas',            $$NULL$$],
    ['proposta_url',              $$NULL$$],
    ['numero_proposta',           $$NULL$$],
    ['contrato_url',              $$NULL$$],
    ['motivo_perda',              $$NULL$$],
    ['auto_lost_at',              $$NULL$$],
    ['auto_lost_reason',          $$NULL$$]
  ];
  v_col_names   text[] := ARRAY[]::text[];
  v_val_exprs   text[] := ARRAY[]::text[];
  v_override_names text[] := ARRAY[]::text[];
  v_sql text;
  i int;
  v_col text;
  v_expr text;
BEGIN
  -- 1. Ler lead origem
  SELECT panel_id, status_lead::text
    INTO v_panel_id, v_status
    FROM public.leads
   WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_panel_id NOT IN ('comercial','comerc') THEN
    RETURN NULL;
  END IF;

  IF v_status <> 'contrato_assinado' THEN
    RETURN NULL;
  END IF;

  -- 2. Validar coluna destino em pipeline_stages_config
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages_config
     WHERE panel_key = 'onboarding'
       AND value     = 'etapa_onboarding_1777497467069'
  ) THEN
    RAISE EXCEPTION 'Coluna destino do Onboarding (etapa_onboarding_1777497467069) nao encontrada em pipeline_stages_config';
  END IF;

  -- 3. Idempotencia
  SELECT onboarding_lead_id INTO v_existing
    FROM public.lead_onboarding_links
   WHERE commercial_lead_id = p_lead_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- 4. Bypass do trigger protect_lead_anon_token_update
  PERFORM set_config('app.system_lead_update', 'on', true);

  -- 5. Montar INSERT dinamico

  -- 5a. Overrides: incluir apenas se a coluna existir
  FOR i IN 1 .. array_length(v_overrides, 1) LOOP
    v_col  := v_overrides[i][1];
    v_expr := v_overrides[i][2];
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'leads'
         AND column_name  = v_col
    ) THEN
      v_col_names      := v_col_names      || quote_ident(v_col);
      v_val_exprs      := v_val_exprs      || v_expr;
      v_override_names := v_override_names || v_col;
    END IF;
  END LOOP;

  -- 5b. Colunas copiadas do origem, excluindo overrides
  FOREACH v_col IN ARRAY v_copy_cols LOOP
    IF v_col = ANY (v_override_names) THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'leads'
         AND column_name  = v_col
    ) THEN
      v_col_names := v_col_names || quote_ident(v_col);
      v_val_exprs := v_val_exprs || ('src.' || quote_ident(v_col));
    END IF;
  END LOOP;

  v_sql := format(
    'INSERT INTO public.leads (%s) SELECT %s FROM public.leads src WHERE src.id = $1 RETURNING id',
    array_to_string(v_col_names, ', '),
    array_to_string(v_val_exprs, ', ')
  );

  EXECUTE v_sql USING p_lead_id INTO v_new_id;

  -- 6. Vinculo
  INSERT INTO public.lead_onboarding_links (commercial_lead_id, onboarding_lead_id)
  VALUES (p_lead_id, v_new_id);

  RETURN v_new_id;
END;
$fn$;

-- 3. Trigger function + trigger
CREATE OR REPLACE FUNCTION public.trg_leads_ensure_onboarding_card_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $tg$
BEGIN
  PERFORM public.ensure_onboarding_card_from_contract_signed(NEW.id);
  RETURN NEW;
END;
$tg$;

DROP TRIGGER IF EXISTS trg_leads_ensure_onboarding_card ON public.leads;
CREATE TRIGGER trg_leads_ensure_onboarding_card
AFTER INSERT OR UPDATE OF status_lead, panel_id ON public.leads
FOR EACH ROW
WHEN (
  NEW.panel_id IN ('comercial','comerc')
  AND NEW.status_lead::text = 'contrato_assinado'
)
EXECUTE FUNCTION public.trg_leads_ensure_onboarding_card_fn();

-- 4. Revogar execucao publica das funcoes SECURITY DEFINER
REVOKE ALL ON FUNCTION public.ensure_onboarding_card_from_contract_signed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_onboarding_card_from_contract_signed(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_onboarding_card_from_contract_signed(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.trg_leads_ensure_onboarding_card_fn() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_leads_ensure_onboarding_card_fn() FROM anon;
REVOKE ALL ON FUNCTION public.trg_leads_ensure_onboarding_card_fn() FROM authenticated;

-- 5. Backfill
DO $bf$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.leads
     WHERE panel_id IN ('comercial','comerc')
       AND status_lead::text = 'contrato_assinado'
  LOOP
    PERFORM public.ensure_onboarding_card_from_contract_signed(r.id);
  END LOOP;
END
$bf$;
