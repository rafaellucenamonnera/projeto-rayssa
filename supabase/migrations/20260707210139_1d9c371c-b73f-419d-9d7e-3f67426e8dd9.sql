
-- Função principal
CREATE OR REPLACE FUNCTION public.ensure_training_panel_campaign_card(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_panel_id   text;
  v_status     text;
  v_existing   uuid;
  v_new_id     uuid;
  v_copy_cols  text[] := ARRAY[
    'nome_fantasia','razao_social','cnpj',
    'nome_responsavel','telefone_responsavel','email_responsavel',
    'parceiro_id','cidade','consultor',
    'health_status','impact_level',
    'quantidade_lojas','quantidade_funcionarios',
    'descricao_necessidade','erp_utilizado',
    'responsavel_comercial_nome','responsavel_comercial_telefone','responsavel_comercial_email',
    'responsavel_tecnico_nome','responsavel_tecnico_telefone','responsavel_tecnico_email',
    'responsavel_rh_nome','responsavel_rh_telefone','responsavel_rh_email'
  ];
  v_overrides text[][] := ARRAY[
    ['panel_id',                 $$'campanhas'::text$$],
    ['status',                   $$'campanha'::text$$],
    ['status_lead',              $$'etapa_campanhas_1781056513527'$$],
    ['origem',                   $$'copia_automatica_treinamento_painel'::text$$],
    ['dados_completos',          $$true$$],
    ['dados_contrato_completos', $$true$$],
    ['completion_token',         $$NULL$$],
    ['parcelas_pagas',           $$NULL$$],
    ['proposta_url',             $$NULL$$],
    ['numero_proposta',          $$NULL$$],
    ['contrato_url',             $$NULL$$],
    ['motivo_perda',             $$NULL$$],
    ['auto_lost_at',             $$NULL$$],
    ['auto_lost_reason',         $$NULL$$]
  ];
  v_col_names      text[] := ARRAY[]::text[];
  v_val_exprs      text[] := ARRAY[]::text[];
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

  -- 2. Guard
  IF v_panel_id <> 'painel_mrb33dc3' OR v_status <> 'etapa_painel_mrb33dc3_2' THEN
    RETURN NULL;
  END IF;

  -- 3. Advisory lock contra corrida
  PERFORM pg_advisory_xact_lock(hashtextextended(p_lead_id::text, 0));

  -- 4. Destino tem que existir
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages_config
     WHERE panel_key = 'campanhas'
       AND value     = 'etapa_campanhas_1781056513527'
  ) THEN
    RAISE EXCEPTION 'Coluna destino em Campanhas (etapa_campanhas_1781056513527) não encontrada em pipeline_stages_config';
  END IF;

  -- 5. Idempotência
  SELECT campaign_lead_id INTO v_existing
    FROM public.lead_training_panel_campaign_links
   WHERE source_lead_id = p_lead_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- 6. Bypass do trigger protect_lead_anon_token_update
  PERFORM set_config('app.system_lead_update', 'on', true);

  -- 7. Overrides (só se coluna existir)
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

  -- 8. Colunas copiadas do origem, excluindo overrides
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

  -- 9. Vínculo
  INSERT INTO public.lead_training_panel_campaign_links (source_lead_id, campaign_lead_id)
  VALUES (p_lead_id, v_new_id);

  RETURN v_new_id;
END;
$function$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_leads_ensure_training_panel_campaign_card_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.panel_id = 'painel_mrb33dc3'
     AND NEW.status_lead::text = 'etapa_painel_mrb33dc3_2'
     AND (
       TG_OP = 'INSERT'
       OR OLD.status_lead IS DISTINCT FROM NEW.status_lead
       OR OLD.panel_id    IS DISTINCT FROM NEW.panel_id
     )
  THEN
    PERFORM public.ensure_training_panel_campaign_card(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Revogar execução pública
REVOKE ALL ON FUNCTION public.ensure_training_panel_campaign_card(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_leads_ensure_training_panel_campaign_card_fn()
  FROM PUBLIC, anon, authenticated;

-- Trigger
DROP TRIGGER IF EXISTS trg_leads_ensure_training_panel_campaign_card ON public.leads;
CREATE TRIGGER trg_leads_ensure_training_panel_campaign_card
  AFTER INSERT OR UPDATE OF status_lead, panel_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_leads_ensure_training_panel_campaign_card_fn();

-- Backfill idempotente
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.leads
     WHERE panel_id = 'painel_mrb33dc3'
       AND status_lead::text = 'etapa_painel_mrb33dc3_2'
       AND id NOT IN (SELECT source_lead_id FROM public.lead_training_panel_campaign_links)
  LOOP
    PERFORM public.ensure_training_panel_campaign_card(r.id);
  END LOOP;
END $$;
