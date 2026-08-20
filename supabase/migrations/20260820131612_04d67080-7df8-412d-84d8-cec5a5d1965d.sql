ALTER TABLE public.cross_onboarding_steps DROP CONSTRAINT IF EXISTS cross_onboarding_steps_step_check;
ALTER TABLE public.cross_onboarding_steps ADD CONSTRAINT cross_onboarding_steps_step_check CHECK (step IN (
  'codigo_validado','codigo_aplicado','card_movido_material','canva_pendente','canva_pronto','html_pronto','email_pendente','email_enviado','card_movido'
));

-- Situacao consolidada do fluxo de um card
CREATE OR REPLACE FUNCTION public.cross_onboarding_card_status(p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.representative_cards%ROWTYPE;
  v_step public.cross_onboarding_steps%ROWTYPE;
  v_has_code boolean;
  v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta')) THEN
    RAISE EXCEPTION 'Sem permissao';
  END IF;

  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % nao encontrado', p_card_id;
  END IF;

  v_has_code := COALESCE(NULLIF(btrim(COALESCE(v_card.codigo_monnera, '')), ''), NULL) IS NOT NULL;

  SELECT * INTO v_step
  FROM public.cross_onboarding_steps
  WHERE card_id = p_card_id
    AND status IN ('erro','bloqueado','pendencia_manual')
  ORDER BY updated_at DESC
  LIMIT 1;

  v_result := jsonb_build_object(
    'card_id', p_card_id,
    'stage_id', v_card.stage_id,
    'codigo_monnera', v_card.codigo_monnera,
    'has_codigo', v_has_code,
    'canva_public_url', v_card.canva_public_url,
    'failed_step', NULL,
    'failed_status', NULL,
    'failed_reason', NULL,
    'failed_at', NULL,
    'attempt', 0,
    'can_resume', false
  );

  IF FOUND THEN
    v_result := v_result || jsonb_build_object(
      'failed_step', v_step.step,
      'failed_status', v_step.status,
      'failed_reason', v_step.error,
      'failed_at', v_step.finished_at,
      'attempt', v_step.attempt,
      'can_resume', true
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.cross_onboarding_card_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cross_onboarding_card_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cross_onboarding_card_status(uuid) TO service_role;

-- Retomada manual: reinicia somente a etapa pendente
CREATE OR REPLACE FUNCTION public.cross_onboarding_resume(p_card_id uuid, p_justificativa text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.representative_cards%ROWTYPE;
  v_step public.cross_onboarding_steps%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem retomar a automacao';
  END IF;

  IF btrim(COALESCE(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION 'Justificativa obrigatoria';
  END IF;

  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % nao encontrado', p_card_id;
  END IF;

  SELECT * INTO v_step
  FROM public.cross_onboarding_steps
  WHERE card_id = p_card_id
    AND status IN ('erro','bloqueado','pendencia_manual')
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao ha etapa pendente para retomar';
  END IF;

  UPDATE public.cross_onboarding_steps
  SET status = 'pendente', error = NULL
  WHERE id = v_step.id;

  INSERT INTO public.representative_card_history (card_id, action, actor_id, payload)
  VALUES (
    p_card_id,
    'automation_resume',
    auth.uid(),
    jsonb_build_object('step', v_step.step, 'previous_status', v_step.status, 'justificativa', p_justificativa)
  );

  RETURN jsonb_build_object('resume_from', v_step.step, 'previous_status', v_step.status);
END;
$$;

REVOKE ALL ON FUNCTION public.cross_onboarding_resume(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cross_onboarding_resume(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cross_onboarding_resume(uuid, text) TO service_role;

-- Tarefa de pendencia no card: cria ou atualiza, nunca duplica
CREATE OR REPLACE FUNCTION public.cross_onboarding_upsert_pendencia(
  p_card_id uuid,
  p_titulo text,
  p_descricao text,
  p_assigned_to uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.representative_card_tasks
  WHERE representative_card_id = p_card_id
    AND titulo = p_titulo
    AND status = 'pendente'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.representative_card_tasks
    SET descricao = p_descricao, updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.representative_card_tasks (representative_card_id, titulo, descricao, due_at, assigned_to, status)
  VALUES (p_card_id, p_titulo, p_descricao, now() + interval '1 day', p_assigned_to, 'pendente')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cross_onboarding_upsert_pendencia(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cross_onboarding_upsert_pendencia(uuid, text, text, uuid) TO service_role;