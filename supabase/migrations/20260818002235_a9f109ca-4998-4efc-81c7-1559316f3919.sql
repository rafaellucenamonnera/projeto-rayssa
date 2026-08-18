
-- 1. Controle global da ativação (kill switch)
CREATE TABLE IF NOT EXISTS public.gmail_activation_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  max_per_execution integer NOT NULL DEFAULT 1 CHECK (max_per_execution = 1),
  stop_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.gmail_activation_control TO authenticated;
GRANT ALL ON public.gmail_activation_control TO service_role;
ALTER TABLE public.gmail_activation_control ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam controle de ativacao" ON public.gmail_activation_control;
CREATE POLICY "Admins gerenciam controle de ativacao"
ON public.gmail_activation_control FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.gmail_activation_control (id, enabled) VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

-- 2. Registro imutavel de execucoes autorizadas
CREATE TABLE IF NOT EXISTS public.triage_activation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('gmail','whatsapp')),
  source_row_id uuid NOT NULL,
  message_id text,
  cnpj text NOT NULL,
  codigo_monnera text NOT NULL,
  cliente_nome text NOT NULL,
  representative_card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL,
  justification text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  executed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS triage_activation_source_uidx
  ON public.triage_activation_executions (source, source_row_id);
CREATE UNIQUE INDEX IF NOT EXISTS triage_activation_message_uidx
  ON public.triage_activation_executions (message_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS triage_activation_cnpj_codigo_uidx
  ON public.triage_activation_executions (cnpj, codigo_monnera);

GRANT SELECT ON public.triage_activation_executions TO authenticated;
GRANT ALL ON public.triage_activation_executions TO service_role;
ALTER TABLE public.triage_activation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leem execucoes de ativacao" ON public.triage_activation_executions;
CREATE POLICY "Admins leem execucoes de ativacao"
ON public.triage_activation_executions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Pre-visualizacao da confirmacao administrativa
CREATE OR REPLACE FUNCTION public.preview_triage_activation(p_source text, p_row_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gmail public.gmail_processed_messages;
  v_wa record;
  v_calc jsonb;
  v_cnpj text; v_nome text; v_codigo text;
  v_blockers text[] := ARRAY[]::text[];
  v_evidence jsonb := '{}'::jsonb;
  v_message_id text;
  v_suggested uuid;
  v_control public.gmail_activation_control;
  v_existing uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar a ativação.';
  END IF;

  SELECT * INTO v_control FROM public.gmail_activation_control WHERE id;
  IF NOT coalesce(v_control.enabled, false) THEN
    v_blockers := v_blockers || 'Ativação operacional desligada no controle geral';
  END IF;

  IF p_source = 'gmail' THEN
    SELECT * INTO v_gmail FROM public.gmail_processed_messages WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
    v_calc := public.gmail_triage_recompute(v_gmail);
    v_cnpj := v_calc->>'cnpj'; v_nome := v_calc->>'nome'; v_codigo := v_calc->>'codigo';
    v_message_id := v_gmail.message_id;
    v_suggested := coalesce(v_gmail.representative_card_id, v_gmail.matched_card_id);
    v_evidence := jsonb_build_object(
      'assunto', v_gmail.subject, 'remetente', v_gmail.from_address,
      'recebido_em', v_gmail.received_at, 'trecho', v_gmail.body_snippet,
      'cnpj_origem', v_gmail.cnpj_source, 'cnpj_trecho', v_gmail.cnpj_snippet,
      'correcoes_manuais', v_gmail.manual_overrides);
    IF NOT v_gmail.reviewed THEN v_blockers := v_blockers || 'Registro não revisado'; END IF;
    IF coalesce(v_gmail.review_decision,'') ILIKE '%rejeit%' THEN v_blockers := v_blockers || 'Registro rejeitado na revisão'; END IF;
    IF v_gmail.operational_status <> 'liberado' THEN v_blockers := v_blockers || 'Registro não liberado manualmente'; END IF;
    IF (v_calc->>'analysis_result') <> 'triage_ok' THEN v_blockers := v_blockers || 'Status diferente de triage_ok'; END IF;
    IF jsonb_array_length(v_calc->'pending_reasons') > 0 THEN v_blockers := v_blockers || 'Pendências abertas'; END IF;
    IF jsonb_array_length(v_gmail.conflict_notes) > 0 THEN v_blockers := v_blockers || 'Conflito com nova mensagem'; END IF;
    IF jsonb_array_length(v_gmail.cnpj_candidates) > 1 THEN v_blockers := v_blockers || 'Mais de um CNPJ candidato (ambíguo)'; END IF;
  ELSIF p_source = 'whatsapp' THEN
    SELECT * INTO v_wa FROM public.whatsapp_extractions WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Extração de WhatsApp não encontrada.'; END IF;
    v_cnpj := regexp_replace(coalesce(v_wa.cnpj,''), '\D', '', 'g');
    v_nome := btrim(coalesce(v_wa.cliente_nome,''));
    v_codigo := upper(btrim(coalesce(v_wa.codigo_monnera,'')));
    v_suggested := coalesce(v_wa.linked_card_id, v_wa.matched_card_id);
    v_evidence := jsonb_build_object('extraction_id', v_wa.id, 'trechos', v_wa.evidences,
                                     'conversa_inicio', v_wa.conversation_started_at,
                                     'conversa_fim', v_wa.conversation_ended_at);
    IF NOT coalesce(v_wa.reviewed,false) THEN v_blockers := v_blockers || 'Extração não revisada'; END IF;
    IF coalesce(v_wa.review_decision,'') <> 'aprovado' THEN v_blockers := v_blockers || 'Extração não aprovada manualmente'; END IF;
    IF coalesce(v_wa.status,'') <> 'triage_ok' AND coalesce(v_wa.review_decision,'') <> 'aprovado' THEN
      v_blockers := v_blockers || 'Status diferente de triage_ok';
    END IF;
    IF jsonb_array_length(coalesce(v_wa.pending_reasons,'[]'::jsonb)) > 0 THEN v_blockers := v_blockers || 'Pendências abertas'; END IF;
    IF jsonb_array_length(coalesce(v_wa.cnpj_candidates,'[]'::jsonb)) > 1 THEN v_blockers := v_blockers || 'Mais de um CNPJ candidato (ambíguo)'; END IF;
    IF length(v_cnpj) <> 14 THEN v_blockers := v_blockers || 'Sem CNPJ confirmado'; END IF;
    IF v_codigo = '' OR v_codigo !~ '^[A-Z0-9]{8}$' OR v_codigo IN ('3SAXJF92','UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
      v_blockers := v_blockers || 'Código Monnera inválido, ausente ou demonstrativo';
    END IF;
  ELSE
    RAISE EXCEPTION 'Origem inválida.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.triage_activation_executions
              WHERE (source = p_source AND source_row_id = p_row_id)
                 OR (message_id IS NOT NULL AND message_id = v_message_id)
                 OR (cnpj = v_cnpj AND codigo_monnera = v_codigo)) THEN
    v_blockers := v_blockers || 'Registro já processado (idempotência)';
  END IF;

  SELECT id INTO v_existing FROM public.representative_cards
   WHERE panel_id = 'painel_msj9fyji' AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = v_cnpj
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    v_blockers := v_blockers || 'Já existe card no painel Cross com este CNPJ';
  END IF;

  RETURN jsonb_build_object(
    'source', p_source,
    'row_id', p_row_id,
    'cliente', v_nome,
    'cnpj', v_cnpj,
    'codigo_monnera', v_codigo,
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
      'Não move etapas', 'Não cria tarefas', 'Não envia e-mails', 'Não processa outros registros'),
    'bloqueios', to_jsonb(v_blockers),
    'pode_executar', (array_length(v_blockers, 1) IS NULL)
  );
END;
$$;

-- 4. Execucao controlada (1 registro por chamada)
CREATE OR REPLACE FUNCTION public.execute_triage_activation(p_source text, p_row_id uuid, p_justification text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview jsonb;
  v_card_id uuid;
  v_exec_id uuid;
  v_cnpj text; v_nome text; v_codigo text; v_message_id text;
  v_recipient uuid;
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

  INSERT INTO public.representative_cards
    (panel_id, stage_id, full_name, cnpj, source, notes, created_by_user_id)
  VALUES ('painel_msj9fyji', 'etapa_painel_msj9fyji_1', v_nome, v_cnpj,
          CASE WHEN p_source = 'gmail' THEN 'gmail_triagem' ELSE 'whatsapp_triagem' END,
          concat('Origem: ', v_preview->>'origem', ' | Código Monnera: ', v_codigo),
          auth.uid())
  RETURNING id INTO v_card_id;

  INSERT INTO public.triage_activation_executions
    (source, source_row_id, message_id, cnpj, codigo_monnera, cliente_nome,
     representative_card_id, justification, evidence, actions, executed_by)
  VALUES (p_source, p_row_id, v_message_id, v_cnpj, v_codigo, v_nome,
          v_card_id, btrim(p_justification), v_preview->'evidencia', v_preview->'acoes', auth.uid())
  RETURNING id INTO v_exec_id;

  INSERT INTO public.representative_card_history
    (representative_card_id, actor_user_id, actor_label, action, destination_stage_id, payload)
  VALUES (v_card_id, auth.uid(), 'Ativação controlada', 'card_created', 'etapa_painel_msj9fyji_1',
          jsonb_build_object('origem', v_preview->>'origem', 'cnpj', v_cnpj,
                             'codigo_monnera', v_codigo, 'message_id', v_message_id,
                             'evidencia', v_preview->'evidencia',
                             'justificativa', btrim(p_justification),
                             'execution_id', v_exec_id));

  IF p_source = 'gmail' THEN
    UPDATE public.gmail_processed_messages
       SET operational_status = 'processado',
           status = 'processado',
           representative_card_id = v_card_id,
           error = NULL,
           updated_at = now()
     WHERE id = p_row_id;
  ELSE
    UPDATE public.whatsapp_extractions
       SET status = 'processado',
           linked_card_id = v_card_id
     WHERE id = p_row_id;
  END IF;

  FOREACH v_recipient IN ARRAY ARRAY[
    'd8e99940-2a70-40e9-a9e1-2a2f5b47c1a2'::uuid,
    '87842ad6-7c0d-4c3a-9d90-52c6f0c4e0a9'::uuid
  ] LOOP
    BEGIN
      PERFORM public.create_notification(
        v_recipient, 'cross_card_created',
        'Ativação controlada executada',
        concat('Card criado na etapa Cadastro para ', v_nome, ' (CNPJ ', v_cnpj, ') a partir de ', v_preview->>'origem', '.'),
        NULL, NULL, NULL,
        concat('/admin/painel/painel_msj9fyji?card=', v_card_id),
        jsonb_build_object('execution_id', v_exec_id, 'source', p_source, 'codigo_monnera', v_codigo),
        auth.uid(),
        concat('ativacao_controlada:', v_exec_id),
        v_card_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('executed', true, 'card_id', v_card_id, 'execution_id', v_exec_id,
                            'emails_enviados', false, 'registros_processados', 1);
END;
$$;
