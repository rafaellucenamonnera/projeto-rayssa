
-- =========================================================
-- RPC: upsert_teste_monnera_started_lead
-- Cria lead parcial em novo_lead na etapa 1 do Teste Monnera.
-- Não regride status_lead se já estiver adiante.
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_teste_monnera_started_lead(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead         jsonb := coalesce(p_payload->'lead', '{}'::jsonb);
  v_nome         text  := btrim(coalesce(v_lead->>'nome',''));
  v_sobrenome    text  := btrim(coalesce(v_lead->>'sobrenome',''));
  v_email_raw    text  := btrim(coalesce(v_lead->>'email',''));
  v_email        text  := lower(v_email_raw);
  v_telefone     text  := btrim(coalesce(v_lead->>'telefone',''));
  v_tel_digits   text  := regexp_replace(coalesce(v_telefone,''), '\D', '', 'g');
  v_empresa      text  := btrim(coalesce(v_lead->>'empresa',''));
  v_partner_slug text  := nullif(btrim(coalesce(p_payload->>'partner_slug','')), '');

  v_partner_id   uuid;
  v_lead_id      uuid;
  v_nome_full    text;
  v_current_status text;
BEGIN
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email invalido';
  END IF;
  IF length(v_nome) = 0 THEN
    RAISE EXCEPTION 'Nome obrigatorio';
  END IF;
  IF length(v_telefone) = 0 THEN
    RAISE EXCEPTION 'Telefone obrigatorio';
  END IF;
  IF length(v_empresa) = 0 THEN
    RAISE EXCEPTION 'Empresa obrigatoria';
  END IF;

  v_nome_full := btrim(v_nome || CASE WHEN length(v_sobrenome) > 0 THEN ' ' || v_sobrenome ELSE '' END);

  -- Resolver parceiro (mesma lógica do submit)
  IF v_partner_slug IS NOT NULL THEN
    SELECT id INTO v_partner_id
    FROM public.parceiros_comerciais
    WHERE ativo = true
      AND (slug_consultor = v_partner_slug OR codigo_parceiro = v_partner_slug)
    ORDER BY aprovado DESC NULLS LAST, data_cadastro ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    SELECT id INTO v_partner_id
    FROM public.parceiros_comerciais
    WHERE codigo_parceiro = 'MNRTESTE'
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    SELECT id INTO v_partner_id
    FROM public.parceiros_comerciais
    WHERE ativo = true AND aprovado = true
    ORDER BY data_cadastro ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    SELECT id INTO v_partner_id
    FROM public.parceiros_comerciais
    ORDER BY data_cadastro ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum parceiro comercial disponivel para vincular o lead';
  END IF;

  PERFORM set_config('app.system_lead_update', 'on', true);

  -- Match do lead existente (mesma cascata do submit)
  SELECT id, status_lead::text INTO v_lead_id, v_current_status
  FROM public.leads
  WHERE panel_id = 'comercial'
    AND lower(coalesce(email_responsavel,'')) = v_email
  ORDER BY data_cadastro DESC
  LIMIT 1;

  IF v_lead_id IS NULL AND length(v_tel_digits) >= 8 THEN
    SELECT id, status_lead::text INTO v_lead_id, v_current_status
    FROM public.leads
    WHERE panel_id = 'comercial'
      AND regexp_replace(coalesce(telefone_responsavel,''), '\D', '', 'g') = v_tel_digits
    ORDER BY data_cadastro DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    SELECT id, status_lead::text INTO v_lead_id, v_current_status
    FROM public.leads
    WHERE panel_id = 'comercial'
      AND lower(coalesce(nome_fantasia,'')) = lower(v_empresa)
    ORDER BY data_cadastro DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    -- Update básico de campos vazios; NUNCA regride status_lead
    UPDATE public.leads SET
      nome_fantasia        = CASE WHEN coalesce(btrim(nome_fantasia),'') = '' THEN v_empresa ELSE nome_fantasia END,
      nome_responsavel     = CASE WHEN coalesce(btrim(nome_responsavel),'') = '' THEN v_nome_full ELSE nome_responsavel END,
      email_responsavel    = CASE WHEN coalesce(btrim(email_responsavel),'') = '' THEN v_email ELSE email_responsavel END,
      telefone_responsavel = CASE WHEN coalesce(btrim(telefone_responsavel),'') = '' THEN v_telefone ELSE telefone_responsavel END
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      parceiro_id, nome_fantasia, nome_responsavel, telefone_responsavel, email_responsavel,
      origem, status, status_lead, panel_id, dados_completos
    ) VALUES (
      v_partner_id, v_empresa, v_nome_full, v_telefone, v_email,
      'landing_teste_monnera_partial', 'novo_lead',
      'novo_lead', 'comercial', false
    )
    RETURNING id INTO v_lead_id;
  END IF;

  RETURN jsonb_build_object('lead_id', v_lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_teste_monnera_started_lead(jsonb) TO anon, authenticated, service_role;


-- =========================================================
-- RPC: submit_teste_monnera
-- Aceita p_payload->>'lead_id' opcional (alvo direto).
-- Move status_lead para etapa_comercial_1783879107510 sem cast enum.
-- =========================================================
CREATE OR REPLACE FUNCTION public.submit_teste_monnera(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead        jsonb := coalesce(p_payload->'lead', '{}'::jsonb);
  v_nome        text  := btrim(coalesce(v_lead->>'nome',''));
  v_sobrenome   text  := btrim(coalesce(v_lead->>'sobrenome',''));
  v_email_raw   text  := btrim(coalesce(v_lead->>'email',''));
  v_email       text  := lower(v_email_raw);
  v_telefone    text  := btrim(coalesce(v_lead->>'telefone',''));
  v_tel_digits  text  := regexp_replace(coalesce(v_telefone,''), '\D', '', 'g');
  v_empresa     text  := btrim(coalesce(v_lead->>'empresa',''));
  v_cargo       text  := btrim(coalesce(v_lead->>'cargo',''));
  v_segmento    text  := btrim(coalesce(v_lead->>'segmento',''));

  v_answers        jsonb := coalesce(p_payload->'answers', '{}'::jsonb);
  v_scores         jsonb := coalesce(p_payload->'scores', '{}'::jsonb);
  v_classificacao  jsonb := coalesce(p_payload->'classificacao', '{}'::jsonb);
  v_result_color   text  := p_payload->>'result_color';
  v_result_title   text  := p_payload->>'result_title';
  v_result_summary text  := p_payload->>'result_summary';
  v_pontos         jsonb := p_payload->'pontos_atencao';
  v_recomendacao   text  := p_payload->>'recomendacao';
  v_leitura_sdr    jsonb := p_payload->'leitura_sdr';
  v_solicitou      boolean := coalesce((p_payload->>'solicitou_reuniao')::boolean, false);
  v_utm            jsonb := p_payload->'utm';
  v_user_agent     text  := p_payload->>'user_agent';
  v_priority       text  := p_payload->>'priority';
  v_partner_slug   text  := nullif(btrim(coalesce(p_payload->>'partner_slug','')), '');
  v_incoming_lead  text  := nullif(btrim(coalesce(p_payload->>'lead_id','')), '');

  v_partner_id     uuid;
  v_lead_id        uuid;
  v_lead_partner   uuid;
  v_responsible    uuid;
  v_diag_id        uuid;
  v_nome_full      text;
  v_task_title     text := 'Lead solicitou conversa pelo Teste Monnera. Entrar em contato em até 24h.';
  v_existing_task  uuid;
  v_qualified      text := 'etapa_comercial_1783879107510';
BEGIN
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email invalido';
  END IF;
  IF length(v_nome) = 0 THEN
    RAISE EXCEPTION 'Nome obrigatorio';
  END IF;
  IF length(v_telefone) = 0 THEN
    RAISE EXCEPTION 'Telefone obrigatorio';
  END IF;
  IF length(v_empresa) = 0 THEN
    RAISE EXCEPTION 'Empresa obrigatoria';
  END IF;

  v_nome_full := btrim(v_nome || CASE WHEN length(v_sobrenome) > 0 THEN ' ' || v_sobrenome ELSE '' END);

  IF v_partner_slug IS NOT NULL THEN
    SELECT id INTO v_partner_id
    FROM public.parceiros_comerciais
    WHERE ativo = true
      AND (slug_consultor = v_partner_slug OR codigo_parceiro = v_partner_slug)
    ORDER BY aprovado DESC NULLS LAST, data_cadastro ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    SELECT id INTO v_partner_id
    FROM public.parceiros_comerciais
    WHERE codigo_parceiro = 'MNRTESTE'
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    SELECT id INTO v_partner_id
    FROM public.parceiros_comerciais
    WHERE ativo = true AND aprovado = true
    ORDER BY data_cadastro ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    SELECT id INTO v_partner_id FROM public.parceiros_comerciais ORDER BY data_cadastro ASC NULLS LAST LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum parceiro comercial disponivel para vincular o lead';
  END IF;

  PERFORM set_config('app.system_lead_update', 'on', true);

  -- Alvo direto pelo lead_id vindo do fluxo parcial
  IF v_incoming_lead IS NOT NULL THEN
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE id = v_incoming_lead::uuid
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE panel_id = 'comercial'
      AND lower(coalesce(email_responsavel,'')) = v_email
    ORDER BY data_cadastro DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL AND length(v_tel_digits) >= 8 THEN
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE panel_id = 'comercial'
      AND regexp_replace(coalesce(telefone_responsavel,''), '\D', '', 'g') = v_tel_digits
    ORDER BY data_cadastro DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE panel_id = 'comercial'
      AND lower(coalesce(nome_fantasia,'')) = lower(v_empresa)
    ORDER BY data_cadastro DESC
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    SELECT parceiro_id INTO v_lead_partner FROM public.leads WHERE id = v_lead_id;

    UPDATE public.leads SET
      panel_id                        = 'comercial',
      status_lead                     = v_qualified,
      parceiro_id                     = COALESCE(v_lead_partner, v_partner_id),
      nome_fantasia                   = CASE WHEN coalesce(btrim(nome_fantasia),'') = '' THEN v_empresa ELSE nome_fantasia END,
      nome_responsavel                = CASE WHEN coalesce(btrim(nome_responsavel),'') = '' THEN v_nome_full ELSE nome_responsavel END,
      email_responsavel               = CASE WHEN coalesce(btrim(email_responsavel),'') = '' THEN v_email ELSE email_responsavel END,
      telefone_responsavel            = CASE WHEN coalesce(btrim(telefone_responsavel),'') = '' THEN v_telefone ELSE telefone_responsavel END,
      teste_monnera_result_color      = v_result_color,
      teste_monnera_recommendation    = v_recomendacao,
      teste_monnera_priority          = v_priority,
      teste_monnera_scores            = v_scores,
      teste_monnera_solicitou_reuniao = (COALESCE(teste_monnera_solicitou_reuniao, false) OR v_solicitou),
      teste_monnera_submitted_at      = now()
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      parceiro_id, nome_fantasia, nome_responsavel, telefone_responsavel, email_responsavel,
      origem, status, status_lead, panel_id, dados_completos,
      teste_monnera_result_color, teste_monnera_recommendation, teste_monnera_priority,
      teste_monnera_scores, teste_monnera_solicitou_reuniao, teste_monnera_submitted_at
    ) VALUES (
      v_partner_id, v_empresa, v_nome_full, v_telefone, v_email,
      'landing_teste_monnera', 'novo_lead',
      v_qualified, 'comercial', false,
      v_result_color, v_recomendacao, v_priority,
      v_scores, v_solicitou, now()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  INSERT INTO public.teste_monnera_diagnosticos (
    lead_id, respondent_nome, respondent_sobrenome, respondent_email, respondent_telefone,
    respondent_empresa, respondent_cargo, respondent_segmento,
    answers, scores, classificacao,
    result_color, result_title, result_summary,
    pontos_atencao, recomendacao, leitura_sdr,
    solicitou_reuniao, utm, user_agent
  ) VALUES (
    v_lead_id, v_nome, v_sobrenome, v_email, v_telefone,
    v_empresa, v_cargo, v_segmento,
    v_answers, v_scores, v_classificacao,
    v_result_color, v_result_title, v_result_summary,
    v_pontos, v_recomendacao, v_leitura_sdr,
    v_solicitou, v_utm, v_user_agent
  )
  RETURNING id INTO v_diag_id;

  UPDATE public.leads SET teste_monnera_last_diagnostic_id = v_diag_id WHERE id = v_lead_id;

  IF v_solicitou THEN
    SELECT responsible_user_id INTO v_responsible FROM public.leads WHERE id = v_lead_id;

    IF v_responsible IS NULL THEN
      SELECT user_id INTO v_responsible
      FROM public.profiles
      WHERE ativo = true AND can_be_responsible = true
      ORDER BY user_id
      LIMIT 1;
    END IF;

    IF v_responsible IS NULL THEN
      SELECT r.user_id INTO v_responsible
      FROM public.user_roles r
      JOIN public.profiles p ON p.user_id = r.user_id AND p.ativo = true
      WHERE r.role = 'admin'
      ORDER BY r.user_id
      LIMIT 1;
    END IF;

    IF v_responsible IS NULL THEN
      RAISE EXCEPTION 'Nenhum responsável elegível para atribuir a tarefa do Teste Monnera';
    END IF;

    SELECT id INTO v_existing_task
    FROM public.lead_tasks
    WHERE lead_id = v_lead_id
      AND status = 'pendente'
      AND titulo = v_task_title
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_task IS NOT NULL THEN
      UPDATE public.lead_tasks SET
        due_at      = now() + interval '24 hours',
        due_date    = (now() + interval '24 hours')::date,
        assigned_to = v_responsible,
        updated_at  = now()
      WHERE id = v_existing_task;
    ELSE
      INSERT INTO public.lead_tasks (lead_id, titulo, due_at, due_date, status, assigned_to, created_by)
      VALUES (
        v_lead_id,
        v_task_title,
        now() + interval '24 hours',
        (now() + interval '24 hours')::date,
        'pendente',
        v_responsible,
        NULL
      );
    END IF;

    PERFORM public.create_notification(
      v_responsible,
      'teste_monnera_reuniao',
      'Reunião solicitada — Teste Monnera',
      format('%s (%s) concluiu o Teste Monnera e solicitou uma conversa com especialista.', v_nome_full, v_empresa),
      v_lead_id, NULL, NULL,
      '/admin/painel/comercial?card=' || v_lead_id::text,
      jsonb_build_object('diagnostic_id', v_diag_id, 'result_color', v_result_color),
      NULL,
      'teste_monnera_reuniao:' || v_lead_id::text
    );
  END IF;

  RETURN jsonb_build_object('lead_id', v_lead_id, 'diagnostic_id', v_diag_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_teste_monnera(jsonb) TO anon, authenticated, service_role;
