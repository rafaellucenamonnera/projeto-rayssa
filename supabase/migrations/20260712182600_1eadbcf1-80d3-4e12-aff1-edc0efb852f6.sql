
-- 1.1 Garantir coluna "Lead Qualificado" (idempotente)
INSERT INTO public.pipeline_stages_config (panel_key, value, label, sort_order)
SELECT 'comercial', 'etapa_comercial_1783879107510', 'Lead Qualificado',
       COALESCE((SELECT max(sort_order)+1 FROM public.pipeline_stages_config WHERE panel_key='comercial'), 0)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages_config
   WHERE panel_key='comercial' AND value='etapa_comercial_1783879107510'
);

-- 1.2 Tabela teste_monnera_diagnosticos
CREATE TABLE IF NOT EXISTS public.teste_monnera_diagnosticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  respondent_nome text,
  respondent_sobrenome text,
  respondent_email text,
  respondent_telefone text,
  respondent_empresa text,
  respondent_cargo text,
  respondent_segmento text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  classificacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_color text CHECK (result_color IN ('verde','amarelo','vermelho','cinza')),
  result_title text,
  result_summary text,
  pontos_atencao jsonb,
  recomendacao text,
  leitura_sdr jsonb,
  solicitou_reuniao boolean NOT NULL DEFAULT false,
  utm jsonb,
  user_agent text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.teste_monnera_diagnosticos TO authenticated;
GRANT ALL ON public.teste_monnera_diagnosticos TO service_role;

ALTER TABLE public.teste_monnera_diagnosticos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff le diagnosticos teste monnera" ON public.teste_monnera_diagnosticos;
CREATE POLICY "Staff le diagnosticos teste monnera" ON public.teste_monnera_diagnosticos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'leads', 'visualizar')
);

CREATE INDEX IF NOT EXISTS idx_teste_monnera_diag_lead ON public.teste_monnera_diagnosticos (lead_id, submitted_at DESC);

-- 1.3 Colunas-resumo em leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS teste_monnera_last_diagnostic_id uuid REFERENCES public.teste_monnera_diagnosticos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teste_monnera_result_color text,
  ADD COLUMN IF NOT EXISTS teste_monnera_recommendation text,
  ADD COLUMN IF NOT EXISTS teste_monnera_solicitou_reuniao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teste_monnera_priority text,
  ADD COLUMN IF NOT EXISTS teste_monnera_scores jsonb,
  ADD COLUMN IF NOT EXISTS teste_monnera_submitted_at timestamptz;

-- 1.4 RPC submit_teste_monnera
CREATE OR REPLACE FUNCTION public.submit_teste_monnera(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  v_default_parceiro uuid;
  v_lead_id        uuid;
  v_responsible    uuid;
  v_diag_id        uuid;
  v_nome_full      text;
  r_notify         record;
BEGIN
  -- Validações
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

  -- Bypass do trigger anônimo
  PERFORM set_config('app.system_lead_update', 'on', true);

  -- Match: email -> telefone -> nome_fantasia
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE panel_id = 'comercial'
    AND lower(coalesce(email_responsavel,'')) = v_email
  ORDER BY data_cadastro DESC
  LIMIT 1;

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
    -- UPDATE preservando dados existentes
    UPDATE public.leads SET
      status_lead                     = 'etapa_comercial_1783879107510',
      nome_fantasia                   = CASE WHEN coalesce(btrim(nome_fantasia),'') = '' THEN v_empresa ELSE nome_fantasia END,
      nome_responsavel                = CASE WHEN coalesce(btrim(nome_responsavel),'') = '' THEN v_nome_full ELSE nome_responsavel END,
      email_responsavel               = CASE WHEN coalesce(btrim(email_responsavel),'') = '' THEN v_email ELSE email_responsavel END,
      telefone_responsavel            = CASE WHEN coalesce(btrim(telefone_responsavel),'') = '' THEN v_telefone ELSE telefone_responsavel END,
      teste_monnera_result_color      = v_result_color,
      teste_monnera_recommendation    = v_recomendacao,
      teste_monnera_priority          = v_priority,
      teste_monnera_scores            = v_scores,
      teste_monnera_solicitou_reuniao = (teste_monnera_solicitou_reuniao OR v_solicitou),
      teste_monnera_submitted_at      = now()
    WHERE id = v_lead_id;
  ELSE
    -- Precisamos de parceiro_id (NOT NULL). Reutiliza o primeiro parceiro ativo/aprovado como fallback.
    SELECT id INTO v_default_parceiro
    FROM public.parceiros_comerciais
    WHERE ativo = true AND aprovado = true
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;

    IF v_default_parceiro IS NULL THEN
      SELECT id INTO v_default_parceiro FROM public.parceiros_comerciais ORDER BY created_at ASC NULLS LAST LIMIT 1;
    END IF;

    IF v_default_parceiro IS NULL THEN
      RAISE EXCEPTION 'Nenhum parceiro comercial disponivel para vincular o lead';
    END IF;

    INSERT INTO public.leads (
      parceiro_id, nome_fantasia, nome_responsavel, telefone_responsavel, email_responsavel,
      origem, status, status_lead, panel_id, dados_completos,
      teste_monnera_result_color, teste_monnera_recommendation, teste_monnera_priority,
      teste_monnera_scores, teste_monnera_solicitou_reuniao, teste_monnera_submitted_at
    ) VALUES (
      v_default_parceiro, v_empresa, v_nome_full, v_telefone, v_email,
      'landing_teste_monnera', 'novo_lead', 'etapa_comercial_1783879107510', 'comercial', false,
      v_result_color, v_recomendacao, v_priority,
      v_scores, v_solicitou, now()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  -- Insere diagnóstico (linha nova a cada envio)
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

    INSERT INTO public.lead_tasks (lead_id, titulo, due_at, status, assigned_to, created_by)
    VALUES (
      v_lead_id,
      'Contato Teste Monnera — reunião solicitada',
      now() + interval '24 hours',
      'pendente',
      v_responsible,
      NULL
    );

    IF v_responsible IS NOT NULL THEN
      PERFORM public.create_notification(
        v_responsible,
        'teste_monnera_reuniao',
        'Reunião solicitada — Teste Monnera',
        format('%s (%s) concluiu o Teste Monnera e solicitou uma conversa com especialista.', v_nome_full, v_empresa),
        v_lead_id, NULL, NULL,
        '/admin/painel-comercial?card=' || v_lead_id::text,
        jsonb_build_object('diagnostic_id', v_diag_id, 'result_color', v_result_color),
        NULL,
        'teste_monnera_reuniao:' || v_lead_id::text
      );
    ELSE
      FOR r_notify IN
        SELECT DISTINCT mp.user_id
          FROM public.module_permissions mp
         WHERE mp.modulo = 'leads' AND mp.acao = 'visualizar' AND mp.permitido = true
      LOOP
        PERFORM public.create_notification(
          r_notify.user_id,
          'teste_monnera_reuniao',
          'Reunião solicitada — Teste Monnera',
          format('%s (%s) concluiu o Teste Monnera e solicitou uma conversa com especialista.', v_nome_full, v_empresa),
          v_lead_id, NULL, NULL,
          '/admin/painel-comercial?card=' || v_lead_id::text,
          jsonb_build_object('diagnostic_id', v_diag_id, 'result_color', v_result_color),
          NULL,
          'teste_monnera_reuniao:' || v_lead_id::text || ':' || r_notify.user_id::text
        );
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('lead_id', v_lead_id, 'diagnostic_id', v_diag_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_teste_monnera(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_teste_monnera(jsonb) TO anon, authenticated;
