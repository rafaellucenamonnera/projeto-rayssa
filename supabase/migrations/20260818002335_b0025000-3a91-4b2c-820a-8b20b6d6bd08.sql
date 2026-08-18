
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

  FOR v_recipient IN
    SELECT id FROM auth.users
     WHERE lower(email) IN ('rafael.lucena@monnera.com.br','maycon.santos@monnera.com.br')
  LOOP
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

REVOKE EXECUTE ON FUNCTION public.execute_triage_activation(text, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.preview_triage_activation(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.execute_triage_activation(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_triage_activation(text, uuid) TO authenticated;
