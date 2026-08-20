CREATE OR REPLACE FUNCTION public.apply_monnera_code_to_card(p_card_id uuid, p_codigo text, p_source text DEFAULT 'gmail_jira'::text, p_evidence jsonb DEFAULT '{}'::jsonb, p_jira_issue_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text := upper(btrim(coalesce(p_codigo,'')));
  v_card public.representative_cards;
  v_dup uuid;
  v_recipient uuid;
  v_is_test boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem aplicar o código Monnera.';
  END IF;

  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não encontrado.'; END IF;

  IF v_code IN ('UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
    RAISE EXCEPTION 'Código demonstrativo inválido: %', v_code;
  END IF;

  -- Código fictício de QA: aceito somente em card marcado como teste
  IF v_code = 'QATEST01' THEN
    IF NOT coalesce(v_card.test_mode, false) THEN
      RAISE EXCEPTION 'QATEST01 é um código de teste e não pode ser aplicado a cards reais.';
    END IF;
    v_is_test := true;
  ELSIF coalesce(v_card.test_mode, false) THEN
    RAISE EXCEPTION 'Card em modo de teste aceita apenas o código QATEST01.';
  END IF;

  IF v_code ~ '^MNR-[A-Z0-9]+$' THEN
    RAISE EXCEPTION 'Código em formato não confirmado (%). Confirme antes de aplicar.', v_code;
  END IF;
  IF v_code !~ '^[A-Z0-9]{8}$' THEN
    RAISE EXCEPTION 'Código inválido: são exigidos exatamente 8 caracteres A-Z/0-9.';
  END IF;

  SELECT id INTO v_dup FROM public.representative_cards
   WHERE panel_id = v_card.panel_id AND upper(coalesce(codigo_monnera,'')) = v_code AND id <> p_card_id
   LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Código já associado a outro card do painel.';
  END IF;

  IF coalesce(v_card.codigo_monnera,'') <> '' AND upper(v_card.codigo_monnera) <> v_code THEN
    RAISE EXCEPTION 'Código divergente do já registrado no card (%). Resolva a divergência antes.', v_card.codigo_monnera;
  END IF;

  UPDATE public.representative_cards
     SET codigo_monnera = v_code,
         codigo_source = CASE WHEN v_is_test THEN 'codigo_teste' ELSE coalesce(p_source, 'gmail_jira') END,
         codigo_teste = v_is_test,
         codigo_evidencia = coalesce(p_evidence, '{}'::jsonb),
         jira_issue_key = coalesce(p_jira_issue_key, jira_issue_key)
   WHERE id = p_card_id;

  INSERT INTO public.representative_card_history
    (representative_card_id, actor_user_id, actor_label, action, payload)
  VALUES (p_card_id, auth.uid(), 'Código Monnera',
          CASE WHEN v_is_test THEN 'codigo_teste_aplicado' ELSE 'codigo_monnera_aplicado' END,
          jsonb_build_object('codigo', v_code, 'origem', CASE WHEN v_is_test THEN 'codigo_teste' ELSE p_source END,
                             'teste', v_is_test,
                             'jira_issue_key', p_jira_issue_key, 'evidencia', p_evidence));

  IF NOT v_is_test THEN
    FOR v_recipient IN
      SELECT id FROM auth.users
       WHERE lower(email) IN ('rafael.lucena@monnera.com.br','maycon.santos@monnera.com.br')
    LOOP
      BEGIN
        PERFORM public.create_notification(
          v_recipient, 'cross_codigo_monnera',
          'Código Monnera aplicado ao card',
          concat('Código ', v_code, ' registrado no card ', coalesce(v_card.full_name,''), '.'),
          NULL, NULL, NULL,
          concat('/admin/painel/', v_card.panel_id, '?card=', p_card_id),
          jsonb_build_object('codigo', v_code, 'origem', p_source),
          auth.uid(), concat('codigo_monnera:', p_card_id, ':', v_code), p_card_id);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('applied', true, 'codigo', v_code, 'card_id', p_card_id, 'teste', v_is_test);
END;
$function$;

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
  ELSIF v_codigo IN ('UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
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

CREATE OR REPLACE FUNCTION public.register_canva_material(p_card_id uuid, p_codigo text, p_template_design_id text, p_design_id text, p_view_url text, p_edit_url text, p_edited_page integer DEFAULT NULL::integer, p_source text DEFAULT 'manual'::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_public_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_card public.representative_cards%ROWTYPE;
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_public text := trim(coalesce(nullif(trim(coalesce(p_public_url, '')), ''), coalesce(p_view_url, '')));
  v_kind text;
  v_version integer;
  v_id uuid;
BEGIN
  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_nao_encontrado');
  END IF;

  IF coalesce(v_card.is_blocked, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_bloqueado', 'motivo', v_card.blocked_reason);
  END IF;

  IF v_codigo = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_ausente');
  END IF;

  IF v_codigo LIKE 'MNR-%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_formato_nao_confirmado');
  END IF;

  IF v_codigo !~ '^[A-Z0-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_invalido');
  END IF;

  IF v_codigo IN ('UB5PXGDB', 'XXXXXXXX') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_demonstrativo_bloqueado');
  END IF;

  IF v_codigo = 'QATEST01' AND NOT coalesce(v_card.test_mode, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_teste_em_card_real');
  END IF;

  IF coalesce(v_card.codigo_monnera, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_sem_codigo_confirmado');
  END IF;

  IF upper(v_card.codigo_monnera) <> v_codigo THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_divergente_do_card');
  END IF;

  IF NOT public.is_canva_public_link(v_public) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'link_publico_invalido', 'link', v_public);
  END IF;

  v_kind := public.canva_public_link_kind(v_public);

  SELECT coalesce(max(version), 0) + 1 INTO v_version
  FROM public.canva_material_generations WHERE card_id = p_card_id;

  INSERT INTO public.canva_material_generations (
    card_id, cnpj, codigo_monnera, template_design_id, design_id,
    view_url, edit_url, public_url, public_url_kind, edited_page, version, source, test_mode, metadata, created_by
  ) VALUES (
    p_card_id, v_card.cnpj, v_codigo, p_template_design_id, p_design_id,
    p_view_url, p_edit_url, v_public, v_kind, p_edited_page, v_version, coalesce(p_source, 'manual'),
    coalesce(v_card.test_mode, false), coalesce(p_metadata, '{}'::jsonb), auth.uid()
  )
  ON CONFLICT (card_id, codigo_monnera, design_id) DO UPDATE
    SET view_url = EXCLUDED.view_url,
        edit_url = EXCLUDED.edit_url,
        public_url = EXCLUDED.public_url,
        public_url_kind = EXCLUDED.public_url_kind,
        metadata = EXCLUDED.metadata
  RETURNING id, version INTO v_id, v_version;

  UPDATE public.representative_cards
     SET canva_design_id = p_design_id,
         canva_material_url = v_public,
         canva_public_url = v_public,
         canva_internal_url = p_edit_url,
         canva_material_codigo = v_codigo,
         canva_material_version = v_version,
         canva_material_source = coalesce(p_source, 'manual'),
         canva_material_generated_at = now(),
         updated_at = now()
   WHERE id = p_card_id;

  PERFORM public.log_representative_card_event(
    p_card_id,
    'canva_material_gerado',
    jsonb_build_object(
      'design_id', p_design_id,
      'template_design_id', p_template_design_id,
      'codigo', v_codigo,
      'public_url', v_public,
      'public_url_kind', v_kind,
      'internal_url', p_edit_url,
      'view_url', p_view_url,
      'edited_page', p_edited_page,
      'version', v_version,
      'registrado_em', now(),
      'source', coalesce(p_source, 'manual')
    ),
    NULL, NULL
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'version', v_version, 'design_id', p_design_id,
                            'public_url', v_public, 'public_url_kind', v_kind);
END;
$function$;