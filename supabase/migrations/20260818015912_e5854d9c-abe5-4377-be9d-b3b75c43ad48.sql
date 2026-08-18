CREATE OR REPLACE FUNCTION public.cross_card_missing_fields(p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v public.representative_cards;
  v_out jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v FROM public.representative_cards WHERE id = p_card_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  IF coalesce(btrim(v.full_name), '') = '' OR btrim(v.full_name) LIKE '(Sem nome)%' THEN
    v_out := v_out || jsonb_build_object('campo','nome','rotulo','Razão social / nome da empresa');
  END IF;
  IF length(regexp_replace(coalesce(v.cnpj,''), '\D', '', 'g')) <> 14 THEN
    v_out := v_out || jsonb_build_object('campo','cnpj','rotulo','CNPJ completo (14 dígitos)');
  END IF;
  IF coalesce(btrim(v.email), '') = '' THEN
    v_out := v_out || jsonb_build_object('campo','email','rotulo','E-mail de contato do responsável pela operação');
  END IF;

  RETURN v_out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complement_cross_card_from_triage(p_source text, p_row_id uuid, p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vals jsonb;
  v_card public.representative_cards;
  v_applied jsonb := '{}'::jsonb;
  v_sources jsonb;
  v_now text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF');
  v_label text;
  v_result jsonb;
  v_name_missing boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem complementar o card.';
  END IF;

  v_vals := public.triage_row_values(p_source, p_row_id);
  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não encontrado.'; END IF;

  v_label := CASE WHEN p_source = 'gmail' THEN 'gmail_triage' ELSE 'whatsapp_triage' END;
  v_sources := coalesce(v_card.field_sources, '{}'::jsonb);
  v_name_missing := coalesce(btrim(v_card.full_name),'') = '' OR btrim(v_card.full_name) LIKE '(Sem nome)%';

  IF v_name_missing AND coalesce(v_vals->>'nome','') <> '' THEN
    UPDATE public.representative_cards SET full_name = v_vals->>'nome' WHERE id = p_card_id;
    v_applied := v_applied || jsonb_build_object('nome', v_vals->>'nome');
    v_sources := v_sources || jsonb_build_object('nome', jsonb_build_object(
      'fonte', v_label, 'em', v_now, 'evidencia', v_vals->'evidencia'));
  END IF;

  IF length(regexp_replace(coalesce(v_card.cnpj,''), '\D','','g')) <> 14
     AND length(coalesce(v_vals->>'cnpj','')) = 14 THEN
    UPDATE public.representative_cards SET cnpj = v_vals->>'cnpj' WHERE id = p_card_id;
    v_applied := v_applied || jsonb_build_object('cnpj', v_vals->>'cnpj');
    v_sources := v_sources || jsonb_build_object('cnpj', jsonb_build_object(
      'fonte', v_label, 'em', v_now, 'evidencia', v_vals->'evidencia'));
  END IF;

  IF coalesce(btrim(v_card.email),'') = '' AND coalesce(v_vals->>'email','') <> '' THEN
    UPDATE public.representative_cards SET email = v_vals->>'email' WHERE id = p_card_id;
    v_applied := v_applied || jsonb_build_object('email', v_vals->>'email');
    v_sources := v_sources || jsonb_build_object('email', jsonb_build_object(
      'fonte', v_label, 'em', v_now, 'evidencia', v_vals->'evidencia'));
  END IF;

  IF coalesce(btrim(v_card.phone),'') = '' AND coalesce(v_vals->>'telefone','') <> '' THEN
    UPDATE public.representative_cards SET phone = v_vals->>'telefone' WHERE id = p_card_id;
    v_applied := v_applied || jsonb_build_object('telefone', v_vals->>'telefone');
    v_sources := v_sources || jsonb_build_object('telefone', jsonb_build_object(
      'fonte', v_label, 'em', v_now, 'evidencia', v_vals->'evidencia'));
  END IF;

  UPDATE public.representative_cards
     SET field_sources = v_sources,
         origin_source = coalesce(origin_source, v_label),
         origin_message_id = coalesce(origin_message_id, v_vals->>'message_id'),
         origin_thread_id = coalesce(origin_thread_id, v_vals->>'thread_id'),
         updated_at = now()
   WHERE id = p_card_id;

  INSERT INTO public.representative_card_history
    (representative_card_id, actor_user_id, actor_label, action, payload)
  VALUES (p_card_id, auth.uid(), 'Fluxo progressivo', 'card_complemented_from_triage',
          jsonb_build_object('origem', v_label, 'row_id', p_row_id,
                             'campos_aplicados', v_applied,
                             'evidencia', v_vals->'evidencia'));

  IF p_source = 'gmail' THEN
    UPDATE public.gmail_processed_messages
       SET matched_card_id = coalesce(matched_card_id, p_card_id),
           representative_card_id = coalesce(representative_card_id, p_card_id),
           updated_at = now()
     WHERE id = p_row_id;
  ELSE
    UPDATE public.whatsapp_extractions
       SET linked_card_id = coalesce(linked_card_id, p_card_id)
     WHERE id = p_row_id;
  END IF;

  v_result := public.reprocess_cross_card_completion(p_card_id, concat('complemento via ', v_label));
  RETURN v_result || jsonb_build_object('campos_aplicados', v_applied);
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
  v_stage_cad text := 'etapa_painel_msj9fyji_1';
  v_stage_painel text := 'etapa_painel_msj9fyji_2';
  v_label text;
  v_reproc jsonb;
  v_missing jsonb;
  v_advanced boolean := false;
  v_final_stage text;
  v_sources jsonb;
  v_now text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a ativação.';
  END IF;
  IF coalesce(btrim(p_justification), '') = '' THEN
    RAISE EXCEPTION 'Confirme a execução informando a justificativa.';
  END IF;

  v_preview := public.preview_triage_activation(p_source, p_row_id);
  IF NOT (v_preview->>'pode_criar_card')::boolean THEN
    RAISE EXCEPTION 'Execução bloqueada: %', coalesce(v_preview->>'bloqueios', 'pendências abertas');
  END IF;

  v_cnpj := nullif(v_preview->>'cnpj','');
  v_nome := nullif(v_preview->>'cliente','');
  v_codigo := v_preview->>'codigo_monnera';
  v_message_id := v_preview->>'message_id';
  v_thread_id := v_preview->>'thread_id';
  v_email := nullif(v_preview->'dados_card'->>'email','');
  v_telefone := nullif(v_preview->'dados_card'->>'telefone','');
  v_card_action := v_preview->>'card_acao';
  v_label := CASE WHEN p_source = 'gmail' THEN 'gmail_triage' ELSE 'whatsapp_triage' END;

  -- ETAPA 1 — criação ou reuso do card na etapa Cadastro
  IF v_card_action = 'reutilizar' THEN
    v_card_id := (v_preview->>'card_existente_mesmo_cnpj')::uuid;

    SELECT coalesce(field_sources,'{}'::jsonb) INTO v_sources
      FROM public.representative_cards WHERE id = v_card_id FOR UPDATE;

    UPDATE public.representative_cards
       SET email = coalesce(nullif(btrim(coalesce(email,'')),''), v_email),
           phone = coalesce(nullif(btrim(coalesce(phone,'')),''), v_telefone),
           cnpj  = coalesce(nullif(cnpj,''), v_cnpj),
           full_name = CASE WHEN coalesce(btrim(full_name),'') = '' OR btrim(full_name) LIKE '(Sem nome)%'
                            THEN coalesce(v_nome, full_name) ELSE full_name END,
           field_sources = v_sources || jsonb_build_object('ultima_complementacao',
             jsonb_build_object('fonte', v_label, 'em', v_now, 'evidencia', v_preview->'evidencia')),
           origin_source = coalesce(origin_source, v_label),
           origin_message_id = coalesce(origin_message_id, v_message_id),
           origin_thread_id = coalesce(origin_thread_id, v_thread_id),
           updated_at = now()
     WHERE id = v_card_id;

    INSERT INTO public.representative_card_history
      (representative_card_id, actor_user_id, actor_label, action, payload)
    VALUES (v_card_id, auth.uid(), 'Fluxo progressivo', 'card_linked_from_triage',
            jsonb_build_object('decisao','Card já existente — registro associado sem duplicar',
                               'origem', v_preview->>'origem', 'cnpj', v_cnpj,
                               'message_id', v_message_id, 'thread_id', v_thread_id,
                               'evidencia', v_preview->'evidencia'));
  ELSE
    INSERT INTO public.representative_cards
      (panel_id, stage_id, full_name, cnpj, email, phone, source, notes, created_by_user_id,
       field_sources, origin_source, origin_message_id, origin_thread_id)
    VALUES ('painel_msj9fyji', v_stage_cad,
            coalesce(v_nome, concat('(Sem nome) CNPJ ', coalesce(v_cnpj,'—'))),
            v_cnpj, v_email, v_telefone, v_label,
            concat('Origem: ', v_preview->>'origem', ' | message_id: ', coalesce(v_message_id,'—'),
                   ' | thread_id: ', coalesce(v_thread_id,'—')),
            auth.uid(),
            jsonb_build_object('criacao', jsonb_build_object('fonte', v_label, 'em', v_now,
                                                             'evidencia', v_preview->'evidencia')),
            v_label, v_message_id, v_thread_id)
    RETURNING id INTO v_card_id;

    INSERT INTO public.representative_card_history
      (representative_card_id, actor_user_id, actor_label, action, destination_stage_id, payload)
    VALUES (v_card_id, auth.uid(), 'Fluxo progressivo', 'card_created_from_triage', v_stage_cad,
            jsonb_build_object('regra','Regra mínima: nome ou CNPJ + origem rastreável',
                               'origem', v_preview->>'origem', 'cnpj', v_cnpj, 'nome', v_nome,
                               'email', v_email, 'message_id', v_message_id, 'thread_id', v_thread_id,
                               'evidencia', v_preview->'evidencia',
                               'justificativa', btrim(p_justification)));
  END IF;

  -- ETAPA 2 — recalcula pendências e avança automaticamente quando completo
  v_reproc := public.reprocess_cross_card_completion(v_card_id, concat('ativação via ', v_label));
  v_missing := v_reproc->'dados_faltantes';
  v_advanced := coalesce((v_reproc->>'avancou')::boolean, false)
                OR (v_reproc->>'etapa') = v_stage_painel;
  v_final_stage := coalesce(v_reproc->>'etapa', v_stage_cad);

  IF NOT v_advanced THEN
    INSERT INTO public.representative_card_history
      (representative_card_id, actor_user_id, actor_label, action, payload)
    VALUES (v_card_id, auth.uid(), 'Fluxo progressivo', 'card_pending_complement',
            jsonb_build_object('dados_faltantes', v_missing,
                               'bloqueios_avanco', v_preview->'bloqueios_avanco',
                               'acao','Solicitar por e-mail apenas os dados faltantes'));
  END IF;

  INSERT INTO public.triage_activation_executions
    (source, source_row_id, message_id, thread_id, cnpj, codigo_monnera, cliente_nome,
     representative_card_id, justification, evidence, actions, executed_by,
     card_action, final_stage_id, jira_status, jira_payload)
  VALUES (p_source, p_row_id, v_message_id, v_thread_id, coalesce(v_cnpj,''), v_codigo, v_nome,
          v_card_id, btrim(p_justification), v_preview->'evidencia', v_preview->'acoes', auth.uid(),
          v_card_action, v_final_stage,
          CASE WHEN v_advanced THEN 'pendente' ELSE 'aguardando_dados' END,
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
        CASE WHEN v_advanced THEN 'Card avançou para Criação Painel' ELSE 'Card criado — pendente de complementação' END,
        concat(coalesce(v_nome,'(sem nome)'), CASE WHEN coalesce(v_cnpj,'') <> '' THEN concat(' (CNPJ ', v_cnpj, ')') ELSE '' END,
               ' — origem ', v_preview->>'origem', '. ',
               CASE WHEN v_advanced THEN 'Dados mínimos completos; tarefa Jira pendente de criação para Lívia Fernandes.'
                    ELSE concat('Faltam: ',
                      coalesce((SELECT string_agg(x->>'rotulo', '; ') FROM jsonb_array_elements(v_missing) x), '—'), '.') END),
        NULL, NULL, NULL,
        concat('/admin/painel/painel_msj9fyji?card=', v_card_id),
        jsonb_build_object('execution_id', v_exec_id, 'source', p_source,
                           'pendente', NOT v_advanced, 'dados_faltantes', v_missing),
        auth.uid(),
        concat('ativacao_controlada:', v_exec_id),
        v_card_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('executed', true, 'card_id', v_card_id, 'execution_id', v_exec_id,
                            'card_acao', v_card_action,
                            'avancou', v_advanced,
                            'etapa_final', CASE WHEN v_advanced THEN 'Criação Painel' ELSE 'Cadastro (pendente de complementação)' END,
                            'dados_faltantes', v_missing,
                            'jira', (v_preview->'jira') || jsonb_build_object('card_id', v_card_id,
                              'status', CASE WHEN v_advanced THEN 'pendente' ELSE 'aguardando_dados' END),
                            'emails_enviados', false, 'registros_processados', 1);
END;
$function$;