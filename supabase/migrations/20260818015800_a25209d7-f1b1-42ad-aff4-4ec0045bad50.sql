CREATE OR REPLACE FUNCTION public.preview_triage_activation(p_source text, p_row_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  v_cnpj text; v_nome text; v_codigo text; v_cnpj_source text;
  v_email text; v_telefone text; v_message_id text; v_thread_id text;
  v_suggested uuid;
  v_control public.gmail_activation_control;
  v_existing uuid; v_existing_name text; v_blocked_card boolean := false;
  v_existing_email text; v_existing_cnpj text;
  v_create_blockers text[] := ARRAY[]::text[];
  v_advance_blockers text[] := ARRAY[]::text[];
  v_missing jsonb := '[]'::jsonb;
  v_card_action text;
  v_jira_titulo text; v_dup_jira text;
  v_reviewed boolean; v_released boolean;
  v_no_pend boolean; v_no_conf boolean; v_no_amb boolean;
  v_final_nome text; v_final_cnpj text; v_final_email text;
  v_can_create boolean; v_can_advance boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar a ativação.';
  END IF;

  SELECT * INTO v_control FROM public.gmail_activation_control WHERE id;

  v := public.triage_row_values(p_source, p_row_id);
  v_cnpj := coalesce(v->>'cnpj','');
  v_nome := coalesce(v->>'nome','');
  v_codigo := coalesce(v->>'codigo','');
  v_cnpj_source := v->>'cnpj_source';
  v_email := v->>'email';
  v_telefone := v->>'telefone';
  v_message_id := v->>'message_id';
  v_thread_id := v->>'thread_id';
  v_suggested := nullif(v->>'card_sugerido','')::uuid;
  v_reviewed := (v->>'revisado')::boolean;
  v_released := (v->>'liberado')::boolean;
  v_no_pend := jsonb_array_length(coalesce(v->'pendencias','[]'::jsonb)) = 0;
  v_no_conf := coalesce((v->>'conflitos')::int,0) = 0;
  v_no_amb := coalesce((v->>'cnpj_candidatos')::int,0) <= 1;

  -- card existente (mesmo CNPJ ou card sugerido/vinculado)
  IF v_cnpj <> '' THEN
    SELECT id, full_name, coalesce(is_blocked,false), email,
           regexp_replace(coalesce(cnpj,''), '\D','','g')
      INTO v_existing, v_existing_name, v_blocked_card, v_existing_email, v_existing_cnpj
      FROM public.representative_cards
     WHERE panel_id = 'painel_msj9fyji'
       AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = v_cnpj
     ORDER BY created_at LIMIT 1;
  END IF;

  IF v_existing IS NULL AND v_suggested IS NOT NULL THEN
    SELECT id, full_name, coalesce(is_blocked,false), email,
           regexp_replace(coalesce(cnpj,''), '\D','','g')
      INTO v_existing, v_existing_name, v_blocked_card, v_existing_email, v_existing_cnpj
      FROM public.representative_cards WHERE id = v_suggested;
  END IF;

  v_card_action := CASE WHEN v_existing IS NULL THEN 'criar' ELSE 'reutilizar' END;

  -- valores finais considerando o card existente (preservação de dados)
  v_final_nome := nullif(btrim(coalesce(nullif(v_existing_name,''), v_nome)), '');
  v_final_cnpj := CASE WHEN length(coalesce(v_existing_cnpj,'')) = 14 THEN v_existing_cnpj ELSE v_cnpj END;
  v_final_email := nullif(btrim(coalesce(nullif(v_existing_email,''), v_email)), '');

  -- ------------------------------------------------ REGRA MÍNIMA DE CRIAÇÃO
  IF NOT coalesce(v_control.enabled, false) THEN
    v_create_blockers := array_append(v_create_blockers, 'Ativação operacional desligada no controle geral');
  END IF;
  IF coalesce((v->>'rejeitado')::boolean, false) THEN
    v_create_blockers := array_append(v_create_blockers, 'Registro rejeitado na revisão');
  END IF;
  IF coalesce(v_final_nome,'') = '' AND length(coalesce(v_final_cnpj,'')) <> 14 THEN
    v_create_blockers := array_append(v_create_blockers, 'Sem nome/razão social e sem CNPJ identificável');
  END IF;
  IF NOT coalesce((v->>'origem_rastreavel')::boolean, false) THEN
    v_create_blockers := array_append(v_create_blockers, 'Sem origem rastreável (thread, mensagem ou importação)');
  END IF;
  IF coalesce(v_blocked_card,false) THEN
    v_create_blockers := array_append(v_create_blockers, 'Card existente está bloqueado');
  END IF;
  IF EXISTS (SELECT 1 FROM public.triage_activation_executions
              WHERE source = p_source AND source_row_id = p_row_id) THEN
    v_create_blockers := array_append(v_create_blockers, 'Este registro já foi processado (idempotência)');
  END IF;

  -- ---------------------------------------------- REQUISITOS PARA AVANÇAR
  IF coalesce(v_final_nome,'') = '' THEN
    v_missing := v_missing || jsonb_build_object('campo','nome','rotulo','Razão social / nome da empresa');
  END IF;
  IF length(coalesce(v_final_cnpj,'')) <> 14 THEN
    v_missing := v_missing || jsonb_build_object('campo','cnpj','rotulo','CNPJ completo (14 dígitos)');
  END IF;
  IF coalesce(v_final_email,'') = '' THEN
    v_missing := v_missing || jsonb_build_object('campo','email','rotulo','E-mail de contato do responsável pela operação');
  END IF;

  IF jsonb_array_length(v_missing) > 0 THEN
    v_advance_blockers := array_append(v_advance_blockers, 'Dados mínimos incompletos');
  END IF;
  IF NOT v_no_conf THEN v_advance_blockers := array_append(v_advance_blockers, 'Conflito de informações em aberto'); END IF;
  IF NOT v_no_amb THEN v_advance_blockers := array_append(v_advance_blockers, 'Mais de um CNPJ candidato (ambíguo)'); END IF;
  IF NOT (v_reviewed OR v_released) THEN
    v_advance_blockers := array_append(v_advance_blockers, 'Registro ainda não revisado nem liberado');
  END IF;
  IF coalesce(v_blocked_card,false) THEN
    v_advance_blockers := array_append(v_advance_blockers, 'Card bloqueado');
  END IF;

  SELECT jira_issue_key INTO v_dup_jira
    FROM public.triage_activation_executions
   WHERE jira_issue_key IS NOT NULL
     AND ((thread_id IS NOT NULL AND v_thread_id IS NOT NULL AND thread_id = v_thread_id)
          OR (cnpj = v_final_cnpj AND cnpj <> ''))
   LIMIT 1;

  v_jira_titulo := concat('BASTON + ', coalesce(v_final_nome,'(sem nome)'), ' - ', coalesce(v_final_cnpj,''));

  v_can_create := (array_length(v_create_blockers, 1) IS NULL);
  v_can_advance := v_can_create AND (array_length(v_advance_blockers, 1) IS NULL);

  RETURN jsonb_build_object(
    'source', p_source,
    'row_id', p_row_id,
    'cliente', v_final_nome,
    'cnpj', coalesce(v_final_cnpj,''),
    'cnpj_origem', v_cnpj_source,
    'codigo_monnera', v_codigo,
    'codigo_exigido_nesta_etapa', false,
    'etapa_inicial', 'Cadastro',
    'etapa_destino', CASE WHEN v_can_advance THEN 'Criação Painel' ELSE 'Cadastro (pendente de complementação)' END,
    'origem', CASE WHEN p_source = 'gmail' THEN 'Gmail (triagem)' ELSE 'WhatsApp (importação)' END,
    'message_id', v_message_id,
    'thread_id', v_thread_id,
    'evidencia', v->'evidencia',
    'card_sugerido', v_suggested,
    'card_acao', v_card_action,
    'card_existente_mesmo_cnpj', v_existing,
    'card_existente_nome', v_existing_name,
    'dados_card', jsonb_build_object(
      'nome', v_final_nome, 'cnpj', coalesce(v_final_cnpj,''), 'email', v_final_email, 'telefone', v_telefone,
      'origem', CASE WHEN p_source = 'gmail' THEN 'gmail_triage' ELSE 'whatsapp_triage' END,
      'message_id', v_message_id, 'thread_id', v_thread_id),
    'dados_faltantes', v_missing,
    'requisitos_criacao', jsonb_build_array(
      jsonb_build_object('item','Nome/razão social ou CNPJ identificável','ok', coalesce(v_final_nome,'') <> '' OR length(coalesce(v_final_cnpj,'')) = 14),
      jsonb_build_object('item','Origem rastreável (thread, mensagem ou importação)','ok', coalesce((v->>'origem_rastreavel')::boolean,false)),
      jsonb_build_object('item','Registro não rejeitado','ok', NOT coalesce((v->>'rejeitado')::boolean,false)),
      jsonb_build_object('item','Card não bloqueado','ok', NOT coalesce(v_blocked_card,false)),
      jsonb_build_object('item','Registro ainda não processado','ok', NOT EXISTS (
        SELECT 1 FROM public.triage_activation_executions WHERE source = p_source AND source_row_id = p_row_id))
    ),
    'pre_requisitos', jsonb_build_array(
      jsonb_build_object('item','Nome/razão social confirmado','ok', coalesce(v_final_nome,'') <> ''),
      jsonb_build_object('item','CNPJ confirmado (14 dígitos)','ok', length(coalesce(v_final_cnpj,'')) = 14),
      jsonb_build_object('item','E-mail de contato identificado','ok', coalesce(v_final_email,'') <> ''),
      jsonb_build_object('item','Sem conflito de informações','ok', v_no_conf),
      jsonb_build_object('item','Sem ambiguidade de CNPJ','ok', v_no_amb),
      jsonb_build_object('item','Triagem revisada ou liberada','ok', v_reviewed OR v_released),
      jsonb_build_object('item','Sem bloqueio no card','ok', NOT coalesce(v_blocked_card,false)),
      jsonb_build_object('item','Tarefa Jira ainda não criada para esta thread/CNPJ','ok', v_dup_jira IS NULL)
    ),
    'jira', jsonb_build_object(
      'projeto', 'MB (Monnera Board)', 'project_id', '10038',
      'tipo', 'Tarefa', 'issue_type_id', '10042',
      'responsavel', 'Lívia Fernandes',
      'assignee_account_id', '712020:3fcbfcab-7cad-411b-b025-d12c7666e364',
      'titulo', v_jira_titulo,
      'issue_ja_existente', v_dup_jira,
      'sera_criada_agora', v_can_advance AND v_dup_jira IS NULL,
      'campos_descricao', jsonb_build_array('nome','cnpj','card_id','thread_id','message_id',
        'etapa atual','instrução para criar o painel Monnera',
        'instrução para responder com o código alfanumérico de 8 caracteres')),
    'limite_por_execucao', coalesce(v_control.max_per_execution, 1),
    'ativacao_habilitada', coalesce(v_control.enabled, false),
    'pendencias_triagem_abertas', NOT v_no_pend,
    'fluxo', jsonb_build_array(
      'Etapa 1 — ' || CASE WHEN v_card_action = 'criar' THEN 'criar 1 card na etapa Cadastro com o dado disponível' ELSE 'associar ao card existente (sem duplicar) e complementar o que faltar' END,
      CASE WHEN v_can_advance
           THEN 'Etapa 2 — dados mínimos completos: mover o card de Cadastro para Criação Painel'
           ELSE 'Etapa 2 — card fica pendente em Cadastro e o sistema solicita por e-mail apenas: ' ||
                coalesce((SELECT string_agg(x->>'rotulo', '; ') FROM jsonb_array_elements(v_missing) x), '—') END,
      CASE WHEN v_can_advance
           THEN 'Etapa 3 — preparar/registrar a tarefa Jira para Lívia Fernandes'
           ELSE 'Etapa 3 — Jira somente após o card avançar para Criação Painel' END,
      'Reprocessamento — novas respostas de Gmail/WhatsApp complementam o card e o avanço ocorre automaticamente'),
    'acoes', jsonb_build_array(
      CASE WHEN v_card_action = 'criar'
           THEN 'Criar 1 card no painel Onb Clientes Cross na etapa Cadastro'
           ELSE 'Associar o registro ao card já existente (sem duplicar)' END,
      'Preencher apenas os campos vazios, preservando os valores já existentes',
      'Registrar origem, message_id, thread_id e a fonte de cada campo',
      'Registrar o histórico do card',
      CASE WHEN v_can_advance
           THEN 'Mover o card para Criação Painel (dados mínimos completos)'
           ELSE 'Marcar o card como pendente de complementação e listar os dados faltantes' END,
      'Marcar a mensagem como processada',
      'Notificar Rafael e Maycon no sistema'),
    'nao_executa', jsonb_build_array(
      'Não gera material Canva',
      'Não envia e-mail automaticamente nesta execução',
      'Não move o card para Material Onboarding Cliente',
      'Não cria tarefa Jira automaticamente',
      'Não duplica cards nem execuções'),
    'bloqueios', to_jsonb(v_create_blockers),
    'bloqueios_avanco', to_jsonb(v_advance_blockers),
    'pode_criar_card', v_can_create,
    'pode_avancar', v_can_advance,
    'pode_executar', v_can_create
  );
END;
$function$;