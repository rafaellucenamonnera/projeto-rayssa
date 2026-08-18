-- 1) Campos de código Monnera / Jira no card
ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS codigo_monnera text,
  ADD COLUMN IF NOT EXISTS codigo_source text,
  ADD COLUMN IF NOT EXISTS codigo_evidencia jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS jira_issue_key text;

ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS jira_issue_key text,
  ADD COLUMN IF NOT EXISTS release_rule text,
  ADD COLUMN IF NOT EXISTS release_stage text;

-- 2) Recompute com etapas: código só é exigido na etapa "Criação Painel"
CREATE OR REPLACE FUNCTION public.gmail_triage_recompute(p_row gmail_processed_messages)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_cnpj text;
  v_cnpj_source text;
  v_nome text;
  v_codigo text;
  v_pending jsonb := '[]'::jsonb;
  v_stage_pending jsonb := '[]'::jsonb;
  v_status text;
  v_card public.representative_cards;
  v_card_id uuid;
BEGIN
  v_cnpj := regexp_replace(coalesce(p_row.manual_overrides->>'cnpj', p_row.extracted->>'cnpj', ''), '\D', '', 'g');
  v_nome := btrim(coalesce(p_row.manual_overrides->>'nome_parceiro', p_row.extracted->>'nome_parceiro', ''));
  v_codigo := upper(btrim(coalesce(p_row.manual_overrides->>'codigo_monnera', p_row.codigo_encontrado, '')));
  v_cnpj_source := p_row.cnpj_source;

  -- Vínculo inequívoco com card existente completa os dados faltantes
  v_card_id := coalesce(p_row.representative_card_id, p_row.matched_card_id);
  IF v_card_id IS NOT NULL AND jsonb_array_length(coalesce(p_row.cnpj_candidates,'[]'::jsonb)) <= 1 THEN
    SELECT * INTO v_card FROM public.representative_cards WHERE id = v_card_id;
    IF FOUND THEN
      IF length(v_cnpj) <> 14 AND length(regexp_replace(coalesce(v_card.cnpj,''), '\D','','g')) = 14 THEN
        v_cnpj := regexp_replace(v_card.cnpj, '\D','','g');
        v_cnpj_source := 'card_vinculado';
      END IF;
      IF v_nome = '' AND coalesce(btrim(v_card.full_name),'') <> '' THEN
        v_nome := btrim(v_card.full_name);
      END IF;
      IF v_codigo = '' AND coalesce(btrim(v_card.codigo_monnera),'') <> '' THEN
        v_codigo := upper(btrim(v_card.codigo_monnera));
      END IF;
    END IF;
  END IF;

  IF length(v_cnpj) <> 14 THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','sem_cnpj','label','Sem CNPJ','stage','triagem'));
  END IF;
  IF v_nome = '' THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','sem_nome','label','Sem nome','stage','triagem'));
  END IF;

  IF v_codigo = '' THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','sem_codigo','label','Sem código Monnera (exigido só na etapa Criação Painel)','stage','criacao_painel'));
  ELSIF v_codigo IN ('3SAXJF92','UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
    v_pending := v_pending || jsonb_build_array(
      jsonb_build_object('code','codigo_exemplo_invalido','label','Código demonstrativo inválido','stage','criacao_painel'),
      jsonb_build_object('code','sem_codigo','label','Sem código Monnera (exigido só na etapa Criação Painel)','stage','criacao_painel'));
  ELSIF v_codigo !~ '^[A-Z0-9]{8}$' THEN
    v_pending := v_pending || jsonb_build_array(
      jsonb_build_object('code','codigo_formato_nao_confirmado','label','Código em formato não confirmado','stage','criacao_painel'),
      jsonb_build_object('code','sem_codigo','label','Sem código Monnera (exigido só na etapa Criação Painel)','stage','criacao_painel'));
  END IF;

  IF jsonb_array_length(coalesce(p_row.conflict_notes,'[]'::jsonb)) > 0 THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','conflito_nova_mensagem','label','Conflito com nova mensagem','stage','triagem'));
  END IF;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_stage_pending
    FROM jsonb_array_elements(v_pending) x
   WHERE coalesce(x->>'stage','triagem') = 'triagem';

  IF jsonb_array_length(v_stage_pending) = 0 THEN
    v_status := 'triage_ok';
  ELSIF v_stage_pending @> '[{"code":"sem_cnpj"}]'::jsonb THEN
    v_status := 'triage_sem_cnpj';
  ELSIF v_stage_pending @> '[{"code":"sem_nome"}]'::jsonb THEN
    v_status := 'triage_sem_nome';
  ELSE
    v_status := 'triage_conflito_nova_mensagem';
  END IF;

  RETURN jsonb_build_object('pending_reasons', v_pending, 'triage_pending', v_stage_pending,
                            'analysis_result', v_status,
                            'cnpj', v_cnpj, 'cnpj_source', v_cnpj_source, 'nome', v_nome, 'codigo', v_codigo);
END;
$function$;

-- 3) Liberação: só pendências da etapa de triagem bloqueiam
CREATE OR REPLACE FUNCTION public.release_gmail_triage_message(p_row_id uuid, p_justification text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.gmail_processed_messages;
  v_calc jsonb;
  v_rule text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem liberar registros.';
  END IF;
  IF coalesce(btrim(p_justification), '') = '' THEN
    RAISE EXCEPTION 'Confirme a liberação informando a justificativa.';
  END IF;

  SELECT * INTO v_row FROM public.gmail_processed_messages WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
  IF v_row.operational_status = 'liberado' THEN
    RETURN jsonb_build_object('already_released', true);
  END IF;
  IF NOT v_row.reviewed THEN
    RAISE EXCEPTION 'A revisão manual precisa estar aprovada antes da liberação.';
  END IF;

  v_calc := public.gmail_triage_recompute(v_row);
  IF jsonb_array_length(v_calc->'triage_pending') > 0 THEN
    RAISE EXCEPTION 'Registro possui pendências da etapa Triagem/Cadastro e não pode ser liberado.';
  END IF;

  v_rule := CASE
    WHEN (v_calc->>'cnpj_source') = 'card_vinculado'
      THEN 'Dados mínimos completos (CNPJ obtido do card vinculado). Código Monnera não é exigido nesta etapa.'
    ELSE 'Dados mínimos completos (nome e CNPJ confirmados). Código Monnera não é exigido nesta etapa.'
  END;

  UPDATE public.gmail_processed_messages
     SET operational_status = 'liberado',
         analysis_result = 'triage_ok',
         pending_reasons = v_calc->'pending_reasons',
         cnpj_source = coalesce(v_calc->>'cnpj_source', cnpj_source),
         release_rule = v_rule,
         release_stage = 'criacao_painel',
         released_at = now(),
         released_by = auth.uid()
   WHERE id = p_row_id;

  INSERT INTO public.gmail_triage_corrections
    (gmail_message_row_id, field, old_value, new_value, justification, origin, created_by)
  VALUES (p_row_id, 'operational_status', 'bloqueado', 'liberado', btrim(p_justification), 'liberacao', auth.uid());

  RETURN jsonb_build_object('released', true, 'stage', 'criacao_painel', 'rule', v_rule);
END;
$function$;

-- 4) Preview: código Monnera deixa de bloquear a etapa Criação Painel
CREATE OR REPLACE FUNCTION public.preview_triage_activation(p_source text, p_row_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gmail public.gmail_processed_messages;
  v_wa record;
  v_calc jsonb;
  v_cnpj text; v_nome text; v_codigo text; v_cnpj_source text;
  v_blockers text[] := ARRAY[]::text[];
  v_evidence jsonb := '{}'::jsonb;
  v_message_id text;
  v_suggested uuid;
  v_control public.gmail_activation_control;
  v_existing uuid;
  v_wa_pending jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar a ativação.';
  END IF;

  SELECT * INTO v_control FROM public.gmail_activation_control WHERE id;
  IF NOT coalesce(v_control.enabled, false) THEN
    v_blockers := array_append(v_blockers, 'Ativação operacional desligada no controle geral');
  END IF;

  IF p_source = 'gmail' THEN
    SELECT * INTO v_gmail FROM public.gmail_processed_messages WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
    v_calc := public.gmail_triage_recompute(v_gmail);
    v_cnpj := regexp_replace(coalesce(v_calc->>'cnpj',''), '\D', '', 'g');
    v_nome := btrim(coalesce(v_calc->>'nome',''));
    v_codigo := upper(btrim(coalesce(v_calc->>'codigo','')));
    v_cnpj_source := coalesce(v_calc->>'cnpj_source', v_gmail.cnpj_source);
    v_message_id := v_gmail.message_id;
    v_suggested := coalesce(v_gmail.representative_card_id, v_gmail.matched_card_id);
    v_evidence := jsonb_build_object(
      'assunto', v_gmail.subject, 'remetente', v_gmail.from_address,
      'recebido_em', v_gmail.received_at, 'trecho', v_gmail.body_snippet,
      'cnpj_origem', v_cnpj_source, 'cnpj_trecho', v_gmail.cnpj_snippet,
      'correcoes_manuais', v_gmail.manual_overrides);
    IF NOT coalesce(v_gmail.reviewed, false) THEN v_blockers := array_append(v_blockers, 'Registro não revisado'); END IF;
    IF coalesce(v_gmail.review_decision,'') ILIKE '%rejeit%' THEN v_blockers := array_append(v_blockers, 'Registro rejeitado na revisão'); END IF;
    IF coalesce(v_gmail.operational_status,'') <> 'liberado' THEN v_blockers := array_append(v_blockers, 'Registro não liberado manualmente'); END IF;
    IF jsonb_array_length(coalesce(v_calc->'triage_pending','[]'::jsonb)) > 0 THEN v_blockers := array_append(v_blockers, 'Pendências da etapa Triagem/Cadastro em aberto'); END IF;
    IF jsonb_array_length(coalesce(v_gmail.conflict_notes,'[]'::jsonb)) > 0 THEN v_blockers := array_append(v_blockers, 'Conflito com nova mensagem'); END IF;
    IF jsonb_array_length(coalesce(v_gmail.cnpj_candidates,'[]'::jsonb)) > 1 THEN v_blockers := array_append(v_blockers, 'Mais de um CNPJ candidato (ambíguo)'); END IF;
  ELSIF p_source = 'whatsapp' THEN
    SELECT * INTO v_wa FROM public.whatsapp_extractions WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Extração de WhatsApp não encontrada.'; END IF;
    v_cnpj := regexp_replace(coalesce(v_wa.cnpj,''), '\D', '', 'g');
    v_nome := btrim(coalesce(v_wa.cliente_nome,''));
    v_codigo := upper(btrim(coalesce(v_wa.codigo_monnera,'')));
    v_suggested := coalesce(v_wa.linked_card_id, v_wa.matched_card_id);
    v_cnpj_source := 'whatsapp';
    IF length(v_cnpj) <> 14 AND v_suggested IS NOT NULL THEN
      SELECT regexp_replace(coalesce(cnpj,''), '\D','','g') INTO v_cnpj
        FROM public.representative_cards WHERE id = v_suggested;
      IF length(coalesce(v_cnpj,'')) = 14 THEN v_cnpj_source := 'card_vinculado'; END IF;
    END IF;
    v_evidence := jsonb_build_object('extraction_id', v_wa.id, 'trechos', v_wa.evidences,
                                     'conversa_inicio', v_wa.conversation_started_at,
                                     'conversa_fim', v_wa.conversation_ended_at,
                                     'cnpj_origem', v_cnpj_source);
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_wa_pending
      FROM jsonb_array_elements(coalesce(v_wa.pending_reasons,'[]'::jsonb)) x
     WHERE coalesce(x->>'code','') NOT IN ('sem_codigo','codigo_exemplo_invalido','codigo_formato_nao_confirmado')
       AND NOT (coalesce(x->>'code','') = 'sem_cnpj' AND v_cnpj_source = 'card_vinculado');
    IF NOT coalesce(v_wa.reviewed,false) THEN v_blockers := array_append(v_blockers, 'Extração não revisada'); END IF;
    IF coalesce(v_wa.review_decision,'') <> 'aprovado' THEN v_blockers := array_append(v_blockers, 'Extração não aprovada manualmente'); END IF;
    IF jsonb_array_length(v_wa_pending) > 0 THEN v_blockers := array_append(v_blockers, 'Pendências da etapa Triagem/Cadastro em aberto'); END IF;
    IF jsonb_array_length(coalesce(v_wa.cnpj_candidates,'[]'::jsonb)) > 1 THEN v_blockers := array_append(v_blockers, 'Mais de um CNPJ candidato (ambíguo)'); END IF;
  ELSE
    RAISE EXCEPTION 'Origem inválida.';
  END IF;

  IF length(coalesce(v_cnpj,'')) <> 14 THEN v_blockers := array_append(v_blockers, 'Sem CNPJ confirmado e sem vínculo inequívoco com card existente'); END IF;
  IF coalesce(v_nome,'') = '' THEN v_blockers := array_append(v_blockers, 'Sem nome de cliente confirmado'); END IF;

  IF EXISTS (SELECT 1 FROM public.triage_activation_executions
              WHERE (source = p_source AND source_row_id = p_row_id)
                 OR (message_id IS NOT NULL AND message_id = v_message_id)
                 OR (cnpj = v_cnpj AND cnpj <> '')) THEN
    v_blockers := array_append(v_blockers, 'Registro já processado (idempotência)');
  END IF;

  SELECT id INTO v_existing FROM public.representative_cards
   WHERE panel_id = 'painel_msj9fyji' AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = v_cnpj
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    v_blockers := array_append(v_blockers, 'Já existe card no painel Cross com este CNPJ');
  END IF;

  RETURN jsonb_build_object(
    'source', p_source,
    'row_id', p_row_id,
    'cliente', v_nome,
    'cnpj', v_cnpj,
    'cnpj_origem', v_cnpj_source,
    'codigo_monnera', v_codigo,
    'codigo_exigido_nesta_etapa', false,
    'etapa_destino', 'Criação Painel',
    'origem', CASE WHEN p_source = 'gmail' THEN 'Gmail (triagem)' ELSE 'WhatsApp (importação)' END,
    'message_id', v_message_id,
    'evidencia', v_evidence,
    'card_sugerido', v_suggested,
    'card_existente_mesmo_cnpj', v_existing,
    'limite_por_execucao', coalesce(v_control.max_per_execution, 1),
    'ativacao_habilitada', coalesce(v_control.enabled, false),
    'acoes', jsonb_build_array(
      'Criar 1 card no painel Onb Clientes Cross na etapa Cadastro',
      'Registrar a origem da informação e a evidência no card',
      'Registrar o histórico operacional do card',
      'Marcar a mensagem como processada',
      'Notificar Rafael e Maycon no sistema'),
    'nao_executa', jsonb_build_array(
      'Não move etapas', 'Não cria tarefas', 'Não envia e-mails', 'Não processa outros registros',
      'Não gera material Canva'),
    'bloqueios', to_jsonb(v_blockers),
    'pode_executar', (array_length(v_blockers, 1) IS NULL)
  );
END;
$function$;