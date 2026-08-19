ALTER TABLE public.representative_cards ADD COLUMN IF NOT EXISTS codigo_recebido_at timestamptz;

UPDATE public.representative_cards rc
SET codigo_recebido_at = p.first_at
FROM (
  SELECT card_id, MIN(created_at) AS first_at
  FROM public.card_field_provenance
  WHERE field_name = 'codigo_monnera'
  GROUP BY card_id
) p
WHERE p.card_id = rc.id
  AND rc.codigo_recebido_at IS NULL
  AND rc.codigo_monnera IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cross_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  attempt integer NOT NULL DEFAULT 0,
  gate_result jsonb,
  error text,
  payload jsonb,
  codigo_monnera text,
  jira_issue_key text,
  thread_id text,
  message_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cross_onboarding_steps_step_check CHECK (step IN (
    'codigo_validado','canva_pendente','canva_pronto','html_pronto','email_pendente','email_enviado','card_movido'
  )),
  CONSTRAINT cross_onboarding_steps_status_check CHECK (status IN (
    'pendente','executando','sucesso','bloqueado','erro','pendencia_manual'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS cross_onboarding_steps_card_step_uidx
  ON public.cross_onboarding_steps (card_id, step);
CREATE UNIQUE INDEX IF NOT EXISTS cross_onboarding_steps_card_codigo_step_uidx
  ON public.cross_onboarding_steps (card_id, codigo_monnera, step) WHERE codigo_monnera IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cross_onboarding_steps_card_jira_step_uidx
  ON public.cross_onboarding_steps (card_id, jira_issue_key, step) WHERE jira_issue_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cross_onboarding_steps_card_thread_message_uidx
  ON public.cross_onboarding_steps (card_id, thread_id, message_id) WHERE message_id IS NOT NULL;

GRANT SELECT ON public.cross_onboarding_steps TO authenticated;
GRANT ALL ON public.cross_onboarding_steps TO service_role;

ALTER TABLE public.cross_onboarding_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cross_onboarding_steps_read_internal" ON public.cross_onboarding_steps;
CREATE POLICY "cross_onboarding_steps_read_internal"
ON public.cross_onboarding_steps
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta'));

CREATE OR REPLACE FUNCTION public.cross_onboarding_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cross_onboarding_steps_updated_at ON public.cross_onboarding_steps;
CREATE TRIGGER trg_cross_onboarding_steps_updated_at
BEFORE UPDATE ON public.cross_onboarding_steps
FOR EACH ROW EXECUTE FUNCTION public.cross_onboarding_touch_updated_at();

-- Registro transacional e idempotente de uma etapa (bloqueia o card durante a escrita).
CREATE OR REPLACE FUNCTION public.cross_onboarding_record_step(
  p_card_id uuid,
  p_step text,
  p_status text,
  p_gate jsonb DEFAULT NULL,
  p_payload jsonb DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_codigo text DEFAULT NULL,
  p_jira_key text DEFAULT NULL,
  p_thread_id text DEFAULT NULL,
  p_message_id text DEFAULT NULL
)
RETURNS public.cross_onboarding_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.representative_cards%ROWTYPE;
  v_row public.cross_onboarding_steps%ROWTYPE;
BEGIN
  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % nao encontrado', p_card_id;
  END IF;

  IF COALESCE(v_card.is_protected, false) THEN
    RAISE EXCEPTION 'Card protegido: nenhuma etapa pode ser registrada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.protected_entities pe
    WHERE pe.card_id = p_card_id
       OR (pe.cnpj_normalizado IS NOT NULL AND pe.cnpj_normalizado = regexp_replace(COALESCE(v_card.cnpj, ''), '\D', '', 'g'))
  ) THEN
    RAISE EXCEPTION 'Card protegido: nenhuma etapa pode ser registrada';
  END IF;

  SELECT * INTO v_row FROM public.cross_onboarding_steps
  WHERE card_id = p_card_id AND step = p_step;

  IF FOUND AND v_row.status = 'sucesso' THEN
    RETURN v_row; -- idempotente: etapa concluida nao e reexecutada
  END IF;

  INSERT INTO public.cross_onboarding_steps AS s (
    card_id, step, status, attempt, gate_result, error, payload,
    codigo_monnera, jira_issue_key, thread_id, message_id, started_at, finished_at
  ) VALUES (
    p_card_id, p_step, p_status, 1, p_gate, p_error, p_payload,
    p_codigo, p_jira_key, p_thread_id, p_message_id, now(),
    CASE WHEN p_status IN ('sucesso','bloqueado','erro','pendencia_manual') THEN now() ELSE NULL END
  )
  ON CONFLICT (card_id, step) DO UPDATE SET
    status = EXCLUDED.status,
    attempt = s.attempt + 1,
    gate_result = COALESCE(EXCLUDED.gate_result, s.gate_result),
    error = EXCLUDED.error,
    payload = COALESCE(EXCLUDED.payload, s.payload),
    codigo_monnera = COALESCE(EXCLUDED.codigo_monnera, s.codigo_monnera),
    jira_issue_key = COALESCE(EXCLUDED.jira_issue_key, s.jira_issue_key),
    thread_id = COALESCE(EXCLUDED.thread_id, s.thread_id),
    message_id = COALESCE(EXCLUDED.message_id, s.message_id),
    finished_at = CASE WHEN EXCLUDED.status IN ('sucesso','bloqueado','erro','pendencia_manual') THEN now() ELSE NULL END
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.cross_onboarding_record_step(uuid, text, text, jsonb, jsonb, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cross_onboarding_record_step(uuid, text, text, jsonb, jsonb, text, text, text, text, text) TO service_role;