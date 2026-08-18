ALTER TABLE public.triage_activation_executions
  ADD COLUMN IF NOT EXISTS card_action text,
  ADD COLUMN IF NOT EXISTS final_stage_id text,
  ADD COLUMN IF NOT EXISTS jira_issue_key text,
  ADD COLUMN IF NOT EXISTS jira_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS jira_payload jsonb,
  ADD COLUMN IF NOT EXISTS thread_id text;

CREATE OR REPLACE FUNCTION public.preview_triage_activation(p_source text, p_row_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gmail public.gmail_processed_messages;
  v_wa record;
  v_calc jsonb;
  v_cnpj text; v_nome text; v_codigo text; v_cnpj_source text;
  v_email text; v_telefone text;
  v_blockers text[] := ARRAY[]::text[];
  v_prereq jsonb := '[]'::jsonb;
  v_evidence jsonb := '{}'::jsonb;
  v_message_id text; v_thread_id text;
  v_suggested uuid;
  v_control public.gmail_activation_control;
  v_existing uuid;
  v_existing_name text;
  v_wa_pending jsonb := '[]'::jsonb;
  v_card_action text;
  v_jira_titulo text;
  v_dup_jira text;
  v_reviewed boolean := false;
  v_released boolean := false;
  v_no_pend boolean := false;
  v_no_conf boolean := false;
  v_no_amb boolean := false;
  v_blocked_card boolean := false;
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
    v_thread_id := v_gmail.thread_id;
    v_email := nullif(btrim(coalesce(v_gmail.extracted->>'email', v_gmail.extracted->>'focal_email', '')), '');
    IF v_email IS NULL THEN
      v_email := nullif((regexp_match(coalesce(v_gmail.from_address,''), '[^ <>]+@[^ <>]+'))[1], '');
    END IF;
    v_telefone := nullif(btrim(coalesce(v_gmail.extracted->>'telefone', v_gmail.extracted->>'focal_phone','')), '');
    v_suggested := coalesce(v_gmail.representative_card_id, v_gmail.matched_card_id);
    v_evidence := jsonb_build_object(
      'assunto', v_gmail.subject, 'remetente', v_gmail.from_address,
      'recebido_em', v_gmail.received_at, 'trecho', v_gmail.body_snippet,
      'cnpj_origem', v_cnpj_source, 'cnpj_trecho', v_gmail.cnpj_snippet,
      'thread_id', v_thread_id, 'message_id', v_message_id,
      'correcoes_manuais', v_gmail.manual_overrides);

    v_reviewed := coalesce(v_gmail.reviewed, false)
                  AND coalesce(v_gmail.review_decision,'') NOT ILIKE '%rejeit%';
    v_released := coalesce(v_gmail.operational_status,'') = 'liberado';
    v_no_pend := jsonb_array_length(coalesce(v_calc->'triage_pending','[]'::jsonb)) = 0;
    v_no_conf := jsonb_array_length(coalesce(v_gmail.conflict_notes,'[]'::jsonb)) = 0;
    v_no_amb := jsonb_array_length(coalesce(v_gmail.cnpj_candidates,'[]'::jsonb)) <= 1;

    IF NOT coalesce(v_gmail.reviewed, false) THEN v_blockers := array_append(v_blockers, 'Registro não revisado'); END IF;
    IF coalesce(v_gmail.review_decision,'') ILIKE '%rejeit%' THEN v_blockers := array_append(v_blockers, 'Registro rejeitado na revisão'); END IF;
    IF NOT v_released THEN v_blockers := array_append(v_blockers, 'Registro não liberado manualmente'); END IF;
    IF NOT v_no_pend THEN v_blockers := array_append(v_blockers, 'Pendências da etapa Triagem/Cadastro em aberto'); END IF;
    IF NOT v_no_conf THEN v_blockers := array_append(v_blockers, 'Conflito com nova mensagem'); END IF;
    IF NOT v_no_amb THEN v_blockers := array_append(v_blockers, 'Mais de um CNPJ candidato (ambíguo)'); END IF;
  ELSIF p_source = 'whatsapp' THEN
    SELECT * INTO v_wa FROM public.whatsapp_extractions WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Extração de WhatsApp não encontrada.'; END IF;
    v_cnpj := regexp_replace(coalesce(v_wa.cnpj,''), '\D', '', 'g');
    v_nome := btrim(coalesce(v_wa.cliente_nome,''));
    v_codigo := upper(btrim(coalesce(v_wa.codigo_monnera,'')));
    v_suggested := coalesce(v_wa.linked_card_id, v_wa.matched_card_id);
    v_cnpj_source := 'whatsapp';
    v_email := nullif(btrim(coalesce(v_wa.email,'')), '');
    v_telefone := nullif(btrim(coalesce(v_wa.telefone,'')), '');
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

    v_reviewed := coalesce(v_wa.reviewed,false) AND coalesce(v_wa.review_decision,'') = 'aprovado';
    v_released := v_reviewed;
    v_no_pend := jsonb_array_length(v_wa_pending) = 0;
    v_no_conf := true;
    v_no_amb := jsonb_array_length(coalesce(v_wa.cnpj_candidates,'[]'::jsonb)) <= 1;

    IF NOT coalesce(v_wa.reviewed,false) THEN v_blockers := array_append(v_blockers, 'Extração não revisada'); END IF;
    IF coalesce(v_wa.review_decision,'') <> 'aprovado' THEN v_blockers := array_append(v_blockers, 'Extração não aprovada manualmente'); END IF;
    IF NOT v_no_pend THEN v_blockers := array_append(v_blockers, 'Pendências da etapa Triagem/Cadastro em aberto'); END IF;
    IF NOT v_no_amb THEN v_blockers := array_append(v_blockers, 'Mais de um CNPJ candidato (ambíguo)'); END IF;
  ELSE
    RAISE EXCEPTION 'Origem inválida.';
  END IF;

  IF length(coalesce(v_cnpj,'')) <> 14 THEN v_blockers := array_append(v_blockers, 'Sem CNPJ confirmado e sem vínculo inequívoco com card existente'); END IF;
  IF coalesce(v_nome,'') = '' THEN v_blockers := array_append(v_blockers, 'Sem nome de cliente confirmado'); END IF;

  IF EXISTS (SELECT 1 FROM public.triage_activation_executions
              WHERE (source = p_source AND source_row_id = p_row_id)
                 OR (message_id IS NOT NULL AND v_message_id IS NOT NULL AND message_id = v_message_id)
                 OR (cnpj = v_cnpj AND cnpj <> '')) THEN
    v_blockers := array_append(v_blockers, 'Registro já processado (idempotência)');
  END IF;

  -- Card existente com o mesmo CNPJ: reutiliza, não duplica e não bloqueia.
  SELECT id, full_name, coalesce(is_blocked,false)
    INTO v_existing, v_existing_name, v_blocked_card
    FROM public.representative_cards
   WHERE panel_id = 'painel_msj9fyji'
     AND v_cnpj <> ''
     AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = v_cnpj
   ORDER BY created_at
   LIMIT 1;

  IF v_existing IS NULL AND v_suggested IS NOT NULL THEN
    SELECT id, full_name, coalesce(is_blocked,false)
      INTO v_existing, v_existing_name, v_blocked_card
      FROM public.representative_cards WHERE id = v_suggested;
  END IF;

  v_card_action := CASE WHEN v_existing IS NULL THEN 'criar' ELSE 'reutilizar' END;
  IF coalesce(v_blocked_card,false) THEN
    v_blockers := array_append(v_blockers, 'Card existente está bloqueado');
  END IF;

  SELECT jira_issue_key INTO v_dup_jira
    FROM public.triage_activation_executions
   WHERE jira_issue_key IS NOT NULL
     AND ((thread_id IS NOT NULL AND v_thread_id IS NOT NULL AND thread_id = v_thread_id)
          OR (cnpj = v_cnpj AND cnpj <> ''))
   LIMIT 1;

  v_jira_titulo := concat('BASTON + ', v_nome, ' - ', v_cnpj);

  v_prereq := jsonb_build_array(
    jsonb_build_object('item', 'Nome do cliente confirmado', 'ok', coalesce(v_nome,'') <> ''),
    jsonb_build_object('item', 'CNPJ válido e confirmado (14 dígitos)', 'ok', length(coalesce(v_cnpj,'')) = 14),
    jsonb_build_object('item', 'Sem conflito de informações', 'ok', v_no_conf),
    jsonb_build_object('item', 'Sem ambiguidade de CNPJ', 'ok', v_no_amb),
    jsonb_build_object('item', 'Sem bloqueio no card', 'ok', NOT coalesce(v_blocked_card,false)),
    jsonb_build_object('item', 'Registro revisado', 'ok', v_reviewed),
    jsonb_build_object('item', 'Registro liberado manualmente', 'ok', v_released),
    jsonb_build_object('item', 'Sem pendências da etapa Triagem/Cadastro', 'ok', v_no_pend),
    jsonb_build_object('item', 'Tarefa Jira ainda não criada para esta thread/CNPJ', 'ok', v_dup_jira IS NULL)
  );

  RETURN jsonb_build_object(
    'source', p_source,
    'row_id', p_row_id,
    'cliente', v_nome,
    'cnpj', v_cnpj,
    'cnpj_origem', v_cnpj_source,
    'codigo_monnera', v_codigo,
    'codigo_exigido_nesta_etapa', false,
    'etapa_inicial', 'Cadastro',
    'etapa_destino', 'Criação Painel',
    'origem', CASE WHEN p_source = 'gmail' THEN 'Gmail (triagem)' ELSE 'WhatsApp (importação)' END,
    'message_id', v_message_id,
    'thread_id', v_thread_id,
    'evidencia', v_evidence,
    'card_sugerido', v_suggested,
    'card_acao', v_card_action,
    'card_existente_mesmo_cnpj', v_existing,
    'card_existente_nome', v_existing_name,
    'dados_card', jsonb_build_object(
      'nome', v_nome, 'cnpj', v_cnpj, 'email', v_email, 'telefone', v_telefone,
      'origem', CASE WHEN p_source = 'gmail' THEN 'gmail_triage' ELSE 'whatsapp_triage' END,
      'message_id', v_message_id, 'thread_id', v_thread_id),
    'pre_requisitos', v_prereq,
    'jira', jsonb_build_object(
      'projeto', 'MB (Monnera Board)', 'project_id', '10038',
      'tipo', 'Tarefa', 'issue_type_id', '10042',
      'responsavel', 'Lívia Fernandes',
      'assignee_account_id', '712020:3fcbfcab-7cad-411b-b025-d12c7666e364',
      'titulo', v_jira_titulo,
      'issue_ja_existente', v_dup_jira,
      'campos_descricao', jsonb_build_array('nome', 'cnpj', 'card_id', 'thread_id', 'message_id',
        'etapa atual', 'instrução para criar o painel Monnera',
        'instrução para responder com o código alfanumérico de 8 caracteres')),
    'limite_por_execucao', coalesce(v_control.max_per_execution, 1),
    'ativacao_habilitada', coalesce(v_control.enabled, false),
    'fluxo', jsonb_build_array(
      'Etapa 1 — ' || CASE WHEN v_card_action = 'criar' THEN 'criar 1 card na etapa Cadastro' ELSE 'associar ao card existente (sem duplicar)' END,
      'Etapa 2 — validar pré-requisitos e mover o card de Cadastro para Criação Painel',
      'Etapa 3 — preparar/registrar a tarefa Jira para Lívia Fernandes',
      'Fim — aguardar o e-mail com o código Monnera'),
    'acoes', jsonb_build_array(
      CASE WHEN v_card_action = 'criar'
           THEN 'Criar 1 card no painel Onb Clientes Cross na etapa Cadastro'
           ELSE 'Associar o registro ao card já existente com o mesmo CNPJ' END,
      'Preencher nome, CNPJ, e-mail e dados confirmados no card',
      'Registrar origem gmail_triage, message_id e thread_id',
      'Registrar histórico card_created_from_triage / card_linked_from_triage',
      'Validar pré-requisitos e mover o card para Criação Painel (histórico com origem, destino e motivo)',
      'Preparar a tarefa Jira (MB / Tarefa) para Lívia Fernandes',
      'Marcar a mensagem como processada',
      'Notificar Rafael e Maycon no sistema'),
    'nao_executa', jsonb_build_array(
      'Não gera material Canva',
      'Não envia e-mail de onboarding nem qualquer e-mail automático',
      'Não move o card para Material Onboarding Cliente',
      'Não cria tarefa interna adicional',
      'Não executa cron',
      'Não processa outros registros',
      'Não exige o código Monnera nesta etapa'),
    'bloqueios', to_jsonb(v_blockers),
    'pode_executar', (array_length(v_blockers, 1) IS NULL)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_triage_activation(p_source text, p_row_id uuid, p_justification text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_preview jsonb;
  v_card_id uuid;
  v_exec_id uuid;
  v_cnpj text; v_nome text; v_codigo text; v_message_id text; v_thread_id text;
  v_email text; v_telefone text;
  v_card_action text;
  v_recipient uuid;
  v_prereq jsonb;
  v_falhas text;
  v_stage_from text := 'etapa_painel_msj9fyji_1';
  v_stage_to text := 'etapa_painel_msj9fyji_2';
  v_current_stage text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a ativação.';
  END IF;
  IF coalesce(btrim(p_justification), '') = '' THEN
    RAISE EXCEPTION 'Confirme a execução informando a justificativa.';
  END IF;

  v_preview := public.preview_triage_activation(p_source, p_row_id);
  IF NOT (v_preview->>'pode_executar')::boolean THEN
    RAISE EXCEPTION 'Execução bloqueada: %', coalesce(v_preview->>'bloqueios', 'pendências abertas');
  END IF;

  v_cnpj := v_preview->>'cnpj';
  v_nome := v_preview->>'cliente';
  v_codigo := v_preview->>'codigo_monnera';
  v_message_id := v_preview->>'message_id';
  v_thread_id := v_preview->>'thread_id';
  v_email := v_preview->'dados_card'->>'email';
  v_telefone := v_preview->'dados_card'->>'telefone';
  v_card_action := v_preview->>'card_acao';

  -- ETAPA 1 — criação ou reuso do card na etapa Cadastro
  IF v_card_action = 'reutilizar' THEN
    v_card_id := (v_preview->>'card_existente_mesmo_cnpj')::uuid;
    UPDATE public.representative_cards
       SET email = coalesce(email, v_email),
           phone = coalesce(phone, v_telefone),
           cnpj = coalesce(nullif(cnpj,''), v_cnpj),
           updated_at = now()
     WHERE id = v_card_id;
    INSERT INTO public.representative_card_history
      (representative_card_id, actor_user_id, actor_label, action, payload)
    VALUES (v_card_id, auth.uid(), 'Ativação controlada', 'card_linked_from_triage',
            jsonb_build_object('decisao', 'Card já existente para o CNPJ — registro associado sem duplicar',
                               'origem', v_preview->>'origem', 'cnpj', v_cnpj,
                               'message_id', v_message_id, 'thread_id', v_thread_id,
                               'evidencia', v_preview->'evidencia'));
  ELSE
    INSERT INTO public.representative_cards
      (panel_id, stage_id, full_name, cnpj, email, phone, source, notes, created_by_user_id)
    VALUES ('painel_msj9fyji', v_stage_from, v_nome, v_cnpj, v_email, v_telefone,
            CASE WHEN p_source = 'gmail' THEN 'gmail_triage' ELSE 'whatsapp_triage' END,
            concat('Origem: ', v_preview->>'origem', ' | message_id: ', coalesce(v_message_id,'—'),
                   ' | thread_id: ', coalesce(v_thread_id,'—')),
            auth.uid())
    RETURNING id INTO v_card_id;

    INSERT INTO public.representative_card_history
      (representative_card_id, actor_user_id, actor_label, action, destination_stage_id, payload)
    VALUES (v_card_id, auth.uid(), 'Ativação controlada', 'card_created_from_triage', v_stage_from,
            jsonb_build_object('origem', v_preview->>'origem', 'cnpj', v_cnpj,
                               'nome', v_nome, 'email', v_email,
                               'message_id', v_message_id, 'thread_id', v_thread_id,
                               'evidencia', v_preview->'evidencia',
                               'justificativa', btrim(p_justification)));
  END IF;

  -- ETAPA 2 — validação dos pré-requisitos e movimentação para Criação Painel
  v_prereq := v_preview->'pre_requisitos';
  SELECT string_agg(x->>'item', '; ') INTO v_falhas
    FROM jsonb_array_elements(v_prereq) x
   WHERE (x->>'ok')::boolean IS NOT TRUE;
  IF v_falhas IS NOT NULL THEN
    RAISE EXCEPTION 'Movimentação bloqueada — pré-requisitos não atendidos: %', v_falhas;
  END IF;

  SELECT stage_id INTO v_current_stage FROM public.representative_cards WHERE id = v_card_id;

  UPDATE public.representative_cards
     SET stage_id = v_stage_to, updated_at = now()
   WHERE id = v_card_id;

  INSERT INTO public.representative_card_history
    (representative_card_id, actor_user_id, actor_label, action, source_stage_id, destination_stage_id, payload)
  VALUES (v_card_id, auth.uid(), 'Ativação controlada', 'stage_moved_to_criacao_painel',
          v_current_stage, v_stage_to,
          jsonb_build_object('origem_etapa', 'Cadastro', 'destino_etapa', 'Criação Painel',
                             'motivo', 'Pré-requisitos atendidos: nome e CNPJ confirmados, sem conflito, sem ambiguidade, registro revisado e liberado',
                             'pre_requisitos', v_prereq,
                             'justificativa', btrim(p_justification)));

  INSERT INTO public.triage_activation_executions
    (source, source_row_id, message_id, thread_id, cnpj, codigo_monnera, cliente_nome,
     representative_card_id, justification, evidence, actions, executed_by,
     card_action, final_stage_id, jira_status, jira_payload)
  VALUES (p_source, p_row_id, v_message_id, v_thread_id, v_cnpj, v_codigo, v_nome,
          v_card_id, btrim(p_justification), v_preview->'evidencia', v_preview->'acoes', auth.uid(),
          v_card_action, v_stage_to, 'pendente',
          (v_preview->'jira') || jsonb_build_object('card_id', v_card_id))
  RETURNING id INTO v_exec_id;

  IF p_source = 'gmail' THEN
    UPDATE public.gmail_processed_messages
       SET operational_status = 'processado',
           status = 'processado',
           representative_card_id = v_card_id,
           matched_card_id = coalesce(matched_card_id, v_card_id),
           error = NULL,
           updated_at = now()
     WHERE id = p_row_id;
  ELSE
    UPDATE public.whatsapp_extractions
       SET status = 'processado',
           linked_card_id = v_card_id
     WHERE id = p_row_id;
  END IF;

  FOR v_recipient IN
    SELECT id FROM auth.users
     WHERE lower(email) IN ('rafael.lucena@monnera.com.br','maycon.santos@monnera.com.br')
  LOOP
    BEGIN
      PERFORM public.create_notification(
        v_recipient, 'cross_card_created',
        'Ativação controlada executada',
        concat(CASE WHEN v_card_action = 'criar' THEN 'Card criado na etapa Cadastro' ELSE 'Card existente associado' END,
               ' e movido para Criação Painel: ', v_nome, ' (CNPJ ', v_cnpj, ') — origem ', v_preview->>'origem',
               '. Tarefa Jira pendente de criação para Lívia Fernandes.'),
        NULL, NULL, NULL,
        concat('/admin/painel/painel_msj9fyji?card=', v_card_id),
        jsonb_build_object('execution_id', v_exec_id, 'source', p_source, 'etapa', 'Criação Painel'),
        auth.uid(),
        concat('ativacao_controlada:', v_exec_id),
        v_card_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('executed', true, 'card_id', v_card_id, 'execution_id', v_exec_id,
                            'card_acao', v_card_action,
                            'etapa_final', 'Criação Painel',
                            'jira', (v_preview->'jira') || jsonb_build_object('card_id', v_card_id, 'status', 'pendente'),
                            'emails_enviados', false, 'registros_processados', 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_jira_panel_task(
  p_execution_id uuid,
  p_issue_key text,
  p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exec public.triage_activation_executions;
  v_key text := upper(btrim(coalesce(p_issue_key,'')));
  v_dup text;
  v_recipient uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar a tarefa Jira.';
  END IF;
  IF v_key !~ '^MB-[0-9]+$' THEN
    RAISE EXCEPTION 'Chave Jira inválida. Formato esperado: MB-123.';
  END IF;

  SELECT * INTO v_exec FROM public.triage_activation_executions WHERE id = p_execution_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Execução não encontrada.'; END IF;
  IF v_exec.jira_issue_key IS NOT NULL THEN
    RAISE EXCEPTION 'Esta execução já possui a tarefa Jira %.', v_exec.jira_issue_key;
  END IF;
  IF coalesce(v_exec.final_stage_id,'') <> 'etapa_painel_msj9fyji_2' THEN
    RAISE EXCEPTION 'O card precisa estar na etapa Criação Painel antes de registrar a tarefa Jira.';
  END IF;

  SELECT jira_issue_key INTO v_dup
    FROM public.triage_activation_executions
   WHERE id <> p_execution_id AND jira_issue_key IS NOT NULL
     AND ((thread_id IS NOT NULL AND v_exec.thread_id IS NOT NULL AND thread_id = v_exec.thread_id)
          OR (cnpj = v_exec.cnpj AND cnpj <> ''))
   LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe tarefa Jira (%) para esta thread/CNPJ.', v_dup;
  END IF;

  UPDATE public.triage_activation_executions
     SET jira_issue_key = v_key, jira_status = 'criada',
         jira_payload = coalesce(jira_payload,'{}'::jsonb) || coalesce(p_payload,'{}'::jsonb)
   WHERE id = p_execution_id;

  UPDATE public.representative_cards
     SET jira_issue_key = v_key, updated_at = now()
   WHERE id = v_exec.representative_card_id;

  IF v_exec.source = 'gmail' THEN
    UPDATE public.gmail_processed_messages SET jira_issue_key = v_key, updated_at = now()
     WHERE id = v_exec.source_row_id;
  ELSE
    UPDATE public.whatsapp_extractions SET jira_issue_key = v_key WHERE id = v_exec.source_row_id;
  END IF;

  INSERT INTO public.representative_card_history
    (representative_card_id, actor_user_id, actor_label, action, payload)
  VALUES (v_exec.representative_card_id, auth.uid(), 'Ativação controlada', 'jira_task_created',
          jsonb_build_object('jira_issue_key', v_key, 'execution_id', p_execution_id,
                             'projeto', 'MB', 'tipo', 'Tarefa',
                             'responsavel', 'Lívia Fernandes',
                             'thread_id', v_exec.thread_id, 'cnpj', v_exec.cnpj,
                             'payload', p_payload));

  FOR v_recipient IN
    SELECT id FROM auth.users
     WHERE lower(email) IN ('rafael.lucena@monnera.com.br','maycon.santos@monnera.com.br')
  LOOP
    BEGIN
      PERFORM public.create_notification(
        v_recipient, 'cross_card_created',
        'Tarefa Jira registrada',
        concat('Tarefa ', v_key, ' criada para Lívia Fernandes — ', v_exec.cliente_nome,
               ' (CNPJ ', v_exec.cnpj, '). Aguardando o código Monnera por e-mail.'),
        NULL, NULL, NULL,
        concat('/admin/painel/painel_msj9fyji?card=', v_exec.representative_card_id),
        jsonb_build_object('execution_id', p_execution_id, 'jira_issue_key', v_key),
        auth.uid(),
        concat('jira_task:', p_execution_id),
        v_exec.representative_card_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('registered', true, 'jira_issue_key', v_key,
                            'card_id', v_exec.representative_card_id);
END;
$function$;