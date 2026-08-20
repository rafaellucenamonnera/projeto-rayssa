CREATE OR REPLACE FUNCTION public.cross_onboarding_resume(p_card_id uuid, p_justificativa text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.representative_cards%ROWTYPE;
  v_step public.cross_onboarding_steps%ROWTYPE;
  v_label text;
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

  SELECT COALESCE(p.full_name, p.email, 'admin') INTO v_label
  FROM public.profiles p WHERE p.id = auth.uid();

  INSERT INTO public.representative_card_history (representative_card_id, actor_user_id, actor_label, action, payload)
  VALUES (
    p_card_id,
    auth.uid(),
    COALESCE(v_label, 'admin'),
    'automation_resume',
    jsonb_build_object('step', v_step.step, 'previous_status', v_step.status, 'justificativa', p_justificativa)
  );

  RETURN jsonb_build_object('resume_from', v_step.step, 'previous_status', v_step.status);
END;
$$;