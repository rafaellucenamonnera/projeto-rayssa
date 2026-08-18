ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS linked_card_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_by uuid;

CREATE OR REPLACE FUNCTION public.link_gmail_triage_card(p_row_id uuid, p_card_id uuid, p_justification text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.gmail_processed_messages;
  v_card public.representative_cards;
  v_overrides jsonb;
  v_before jsonb;
  v_inherited text[] := '{}';
  v_msg_cnpj text;
  v_card_cnpj text;
  v_nome text;
  v_calc jsonb;
  v_just text := coalesce(nullif(btrim(p_justification), ''), 'Vínculo confirmado manualmente pelo operador na triagem.');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem vincular cards na triagem.';
  END IF;

  SELECT * INTO v_row FROM public.gmail_processed_messages WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
  IF v_row.operational_status = 'processado' THEN
    RAISE EXCEPTION 'Registro já executado: o vínculo não pode ser alterado.';
  END IF;

  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O card não foi encontrado. O vínculo permanece registrado para análise.';
  END IF;

  v_overrides := coalesce(v_row.manual_overrides, '{}'::jsonb);
  v_before := jsonb_build_object('manual_overrides', v_overrides, 'cnpj_source', v_row.cnpj_source,
                                 'matched_card_id', v_row.matched_card_id);

  v_msg_cnpj := regexp_replace(coalesce(v_overrides->>'cnpj', v_row.extracted->>'cnpj', ''), '\D', '', 'g');
  v_card_cnpj := regexp_replace(coalesce(v_card.cnpj, ''), '\D', '', 'g');
  v_nome := btrim(coalesce(v_overrides->>'nome_parceiro', v_row.extracted->>'nome_parceiro', ''));

  IF length(v_msg_cnpj) = 14 AND length(v_card_cnpj) = 14 AND v_msg_cnpj <> v_card_cnpj THEN
    RAISE EXCEPTION 'CNPJ da mensagem (%) diverge do CNPJ do card (%). Corrija o CNPJ antes de vincular.', v_msg_cnpj, v_card_cnpj;
  END IF;

  IF length(v_msg_cnpj) <> 14 AND length(v_card_cnpj) = 14 THEN
    v_overrides := jsonb_set(v_overrides, ARRAY['cnpj'], to_jsonb(v_card_cnpj), true);
    v_inherited := v_inherited || 'cnpj';
    INSERT INTO public.gmail_triage_corrections
      (gmail_message_row_id, field, old_value, new_value, justification, origin, evidence, created_by)
    VALUES (p_row_id, 'cnpj', nullif(v_msg_cnpj, ''), v_card_cnpj, v_just, 'vinculo_card',
            jsonb_build_object('card_id', p_card_id, 'card_nome', v_card.full_name, 'fonte', 'card_vinculado',
                               'message_id', v_row.message_id, 'thread_id', v_row.thread_id), auth.uid());
  END IF;

  IF coalesce(btrim(v_card.full_name), '') <> '' AND v_nome IS DISTINCT FROM btrim(v_card.full_name) THEN
    v_overrides := jsonb_set(v_overrides, ARRAY['nome_parceiro'], to_jsonb(btrim(v_card.full_name)), true);
    v_inherited := v_inherited || 'nome_parceiro';
    INSERT INTO public.gmail_triage_corrections
      (gmail_message_row_id, field, old_value, new_value, justification, origin, evidence, created_by)
    VALUES (p_row_id, 'nome_parceiro', nullif(v_nome, ''), btrim(v_card.full_name), v_just, 'vinculo_card',
            jsonb_build_object('card_id', p_card_id, 'fonte', 'card_vinculado',
                               'message_id', v_row.message_id, 'thread_id', v_row.thread_id), auth.uid());
  END IF;

  INSERT INTO public.gmail_triage_corrections
    (gmail_message_row_id, field, old_value, new_value, justification, origin, evidence, created_by)
  VALUES (p_row_id, 'matched_card_id', v_row.matched_card_id::text, p_card_id::text, v_just, 'vinculo_card',
          jsonb_build_object('card_id', p_card_id, 'card_nome', v_card.full_name, 'card_cnpj', v_card.cnpj,
                             'etapa_card', v_card.stage_id, 'message_id', v_row.message_id,
                             'thread_id', v_row.thread_id, 'remetente', v_row.from_address,
                             'assunto', v_row.subject), auth.uid());

  v_row.manual_overrides := v_overrides;
  v_row.matched_card_id := p_card_id;
  IF 'cnpj' = ANY(v_inherited) THEN v_row.cnpj_source := 'card_vinculado'; END IF;
  v_calc := public.gmail_triage_recompute(v_row);

  UPDATE public.gmail_processed_messages
     SET manual_overrides = v_overrides,
         matched_card_id = p_card_id,
         cnpj_source = coalesce(v_calc->>'cnpj_source', cnpj_source),
         pending_reasons = v_calc->'pending_reasons',
         analysis_result = v_calc->>'analysis_result',
         reviewed = true,
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         review_decision = coalesce(nullif(review_decision, ''), 'aprovado'),
         linked_at = now(),
         linked_by = auth.uid(),
         linked_card_snapshot = jsonb_build_object(
           'card_id', p_card_id,
           'card_nome', v_card.full_name,
           'card_cnpj', v_card.cnpj,
           'card_email', v_card.email,
           'card_telefone', v_card.phone,
           'card_etapa', v_card.stage_id,
           'card_codigo_monnera', v_card.codigo_monnera,
           'campos_herdados', to_jsonb(v_inherited),
           'antes', v_before,
           'confirmado_em', now(),
           'confirmado_por', auth.uid(),
           'evidencia', jsonb_build_object('message_id', v_row.message_id, 'thread_id', v_row.thread_id,
                                           'remetente', v_row.from_address, 'assunto', v_row.subject,
                                           'trecho', left(coalesce(v_row.cnpj_snippet, v_row.body_snippet, ''), 600))
         ),
         operational_status = CASE WHEN jsonb_array_length(v_calc->'triage_pending') = 0 THEN 'liberado' ELSE 'bloqueado' END,
         release_rule = CASE WHEN jsonb_array_length(v_calc->'triage_pending') = 0
           THEN 'Vínculo com card confirmado: dados mínimos completos. Código Monnera exigido apenas na etapa Criação Painel.' ELSE release_rule END,
         release_stage = CASE WHEN jsonb_array_length(v_calc->'triage_pending') = 0 THEN 'criacao_painel' ELSE release_stage END,
         released_at = CASE WHEN jsonb_array_length(v_calc->'triage_pending') = 0 THEN now() ELSE released_at END,
         released_by = CASE WHEN jsonb_array_length(v_calc->'triage_pending') = 0 THEN auth.uid() ELSE released_by END,
         last_correction_at = now()
   WHERE id = p_row_id;

  RETURN jsonb_build_object(
    'linked', true,
    'card_id', p_card_id,
    'card_nome', v_card.full_name,
    'card_etapa', v_card.stage_id,
    'cnpj', v_calc->>'cnpj',
    'cnpj_source', v_calc->>'cnpj_source',
    'nome', v_calc->>'nome',
    'analysis_result', v_calc->>'analysis_result',
    'pending_reasons', v_calc->'pending_reasons',
    'released', jsonb_array_length(v_calc->'triage_pending') = 0
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.unlink_gmail_triage_card(p_row_id uuid, p_justification text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.gmail_processed_messages;
  v_overrides jsonb;
  v_snapshot jsonb;
  v_key text;
  v_calc jsonb;
  v_prev_source text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem desfazer o vínculo.';
  END IF;
  IF coalesce(btrim(p_justification), '') = '' THEN
    RAISE EXCEPTION 'Informe a justificativa para desfazer o vínculo.';
  END IF;

  SELECT * INTO v_row FROM public.gmail_processed_messages WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
  IF v_row.operational_status = 'processado' THEN
    RAISE EXCEPTION 'Registro já executado: o vínculo não pode ser desfeito.';
  END IF;
  IF v_row.matched_card_id IS NULL THEN
    RAISE EXCEPTION 'Este registro não possui vínculo com card.';
  END IF;

  v_snapshot := coalesce(v_row.linked_card_snapshot, '{}'::jsonb);
  v_overrides := coalesce(v_row.manual_overrides, '{}'::jsonb);

  FOR v_key IN SELECT jsonb_array_elements_text(coalesce(v_snapshot->'campos_herdados', '[]'::jsonb)) LOOP
    v_overrides := v_overrides - v_key;
  END LOOP;

  v_prev_source := nullif(v_snapshot#>>'{antes,cnpj_source}', '');

  INSERT INTO public.gmail_triage_corrections
    (gmail_message_row_id, field, old_value, new_value, justification, origin, evidence, created_by)
  VALUES (p_row_id, 'matched_card_id', v_row.matched_card_id::text, NULL, btrim(p_justification), 'desfazer_vinculo',
          jsonb_build_object('snapshot', v_snapshot, 'message_id', v_row.message_id, 'thread_id', v_row.thread_id),
          auth.uid());

  v_row.manual_overrides := v_overrides;
  v_row.matched_card_id := NULL;
  v_row.cnpj_source := v_prev_source;
  v_calc := public.gmail_triage_recompute(v_row);

  UPDATE public.gmail_processed_messages
     SET manual_overrides = v_overrides,
         matched_card_id = NULL,
         cnpj_source = v_prev_source,
         linked_card_snapshot = NULL,
         linked_at = NULL,
         linked_by = NULL,
         pending_reasons = v_calc->'pending_reasons',
         analysis_result = v_calc->>'analysis_result',
         reviewed = false,
         review_decision = NULL,
         reviewed_at = NULL,
         reviewed_by = NULL,
         release_rule = NULL,
         release_stage = NULL,
         released_at = NULL,
         released_by = NULL,
         operational_status = CASE WHEN jsonb_array_length(v_calc->'triage_pending') > 0 THEN 'bloqueado' ELSE 'nao_liberado' END,
         last_correction_at = now()
   WHERE id = p_row_id;

  RETURN jsonb_build_object('unlinked', true, 'analysis_result', v_calc->>'analysis_result',
                            'pending_reasons', v_calc->'pending_reasons',
                            'operational_status', CASE WHEN jsonb_array_length(v_calc->'triage_pending') > 0 THEN 'bloqueado' ELSE 'nao_liberado' END);
END;
$function$;

REVOKE ALL ON FUNCTION public.link_gmail_triage_card(uuid, uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.unlink_gmail_triage_card(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_gmail_triage_card(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_gmail_triage_card(uuid, text) TO authenticated;