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
    v_blockers := array_append(v_blockers, 'Ativação operacional desligada no controle geral');
  END IF;

  IF p_source = 'gmail' THEN
    SELECT * INTO v_gmail FROM public.gmail_processed_messages WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
    v_calc := public.gmail_triage_recompute(v_gmail);
    v_cnpj := regexp_replace(coalesce(v_calc->>'cnpj',''), '\D', '', 'g');
    v_nome := btrim(coalesce(v_calc->>'nome',''));
    v_codigo := upper(btrim(coalesce(v_calc->>'codigo','')));
    v_message_id := v_gmail.message_id;
    v_suggested := coalesce(v_gmail.representative_card_id, v_gmail.matched_card_id);
    v_evidence := jsonb_build_object(
      'assunto', v_gmail.subject, 'remetente', v_gmail.from_address,
      'recebido_em', v_gmail.received_at, 'trecho', v_gmail.body_snippet,
      'cnpj_origem', v_gmail.cnpj_source, 'cnpj_trecho', v_gmail.cnpj_snippet,
      'correcoes_manuais', v_gmail.manual_overrides);
    IF NOT coalesce(v_gmail.reviewed, false) THEN v_blockers := array_append(v_blockers, 'Registro não revisado'); END IF;
    IF coalesce(v_gmail.review_decision,'') ILIKE '%rejeit%' THEN v_blockers := array_append(v_blockers, 'Registro rejeitado na revisão'); END IF;
    IF coalesce(v_gmail.operational_status,'') <> 'liberado' THEN v_blockers := array_append(v_blockers, 'Registro não liberado manualmente'); END IF;
    IF (v_calc->>'analysis_result') <> 'triage_ok' THEN v_blockers := array_append(v_blockers, 'Status diferente de triage_ok'); END IF;
    IF jsonb_array_length(coalesce(v_calc->'pending_reasons','[]'::jsonb)) > 0 THEN v_blockers := array_append(v_blockers, 'Pendências abertas'); END IF;
    IF jsonb_array_length(coalesce(v_gmail.conflict_notes,'[]'::jsonb)) > 0 THEN v_blockers := array_append(v_blockers, 'Conflito com nova mensagem'); END IF;
    IF jsonb_array_length(coalesce(v_gmail.cnpj_candidates,'[]'::jsonb)) > 1 THEN v_blockers := array_append(v_blockers, 'Mais de um CNPJ candidato (ambíguo)'); END IF;
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
    IF NOT coalesce(v_wa.reviewed,false) THEN v_blockers := array_append(v_blockers, 'Extração não revisada'); END IF;
    IF coalesce(v_wa.review_decision,'') <> 'aprovado' THEN v_blockers := array_append(v_blockers, 'Extração não aprovada manualmente'); END IF;
    IF jsonb_array_length(coalesce(v_wa.pending_reasons,'[]'::jsonb)) > 0 THEN v_blockers := array_append(v_blockers, 'Pendências abertas'); END IF;
    IF jsonb_array_length(coalesce(v_wa.cnpj_candidates,'[]'::jsonb)) > 1 THEN v_blockers := array_append(v_blockers, 'Mais de um CNPJ candidato (ambíguo)'); END IF;
  ELSE
    RAISE EXCEPTION 'Origem inválida.';
  END IF;

  IF length(v_cnpj) <> 14 THEN v_blockers := array_append(v_blockers, 'Sem CNPJ confirmado'); END IF;
  IF coalesce(v_nome,'') = '' THEN v_blockers := array_append(v_blockers, 'Sem nome de cliente confirmado'); END IF;
  IF v_codigo = '' OR v_codigo !~ '^[A-Z0-9]{8}$'
     OR v_codigo IN ('3SAXJF92','UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
    v_blockers := array_append(v_blockers, 'Código Monnera inválido, ausente ou demonstrativo');
  END IF;

  IF EXISTS (SELECT 1 FROM public.triage_activation_executions
              WHERE (source = p_source AND source_row_id = p_row_id)
                 OR (message_id IS NOT NULL AND message_id = v_message_id)
                 OR (cnpj = v_cnpj AND codigo_monnera = v_codigo)) THEN
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
$function$;

REVOKE ALL ON FUNCTION public.preview_triage_activation(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_triage_activation(text, uuid) TO authenticated, service_role, supabase_read_only_user;