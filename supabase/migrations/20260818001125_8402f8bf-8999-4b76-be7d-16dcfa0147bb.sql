
ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS pending_reason_manual text,
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'bloqueado',
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid,
  ADD COLUMN IF NOT EXISTS conflict_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_correction_at timestamptz;

ALTER TABLE public.whatsapp_extractions
  ADD COLUMN IF NOT EXISTS suggested_gmail_message_id uuid,
  ADD COLUMN IF NOT EXISTS suggestion_applied_at timestamptz;

CREATE TABLE IF NOT EXISTS public.gmail_triage_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_row_id uuid NOT NULL REFERENCES public.gmail_processed_messages(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  justification text NOT NULL,
  origin text NOT NULL DEFAULT 'manual',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gmail_triage_corrections_row
  ON public.gmail_triage_corrections(gmail_message_row_id, created_at DESC);

GRANT SELECT, INSERT ON public.gmail_triage_corrections TO authenticated;
GRANT ALL ON public.gmail_triage_corrections TO service_role;

ALTER TABLE public.gmail_triage_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem correcoes de triagem" ON public.gmail_triage_corrections;
CREATE POLICY "Admins veem correcoes de triagem"
  ON public.gmail_triage_corrections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins registram correcoes de triagem" ON public.gmail_triage_corrections;
CREATE POLICY "Admins registram correcoes de triagem"
  ON public.gmail_triage_corrections FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.gmail_triage_recompute(p_row public.gmail_processed_messages)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cnpj text;
  v_nome text;
  v_codigo text;
  v_pending jsonb := '[]'::jsonb;
  v_status text;
BEGIN
  v_cnpj := regexp_replace(coalesce(p_row.manual_overrides->>'cnpj', p_row.extracted->>'cnpj', ''), '\D', '', 'g');
  v_nome := btrim(coalesce(p_row.manual_overrides->>'nome_parceiro', p_row.extracted->>'nome_parceiro', ''));
  v_codigo := upper(btrim(coalesce(p_row.manual_overrides->>'codigo_monnera', p_row.codigo_encontrado, '')));

  IF length(v_cnpj) <> 14 THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','sem_cnpj','label','Sem CNPJ'));
  END IF;
  IF v_nome = '' THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','sem_nome','label','Sem nome'));
  END IF;

  IF v_codigo = '' THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','sem_codigo','label','Sem código Monnera'));
  ELSIF v_codigo IN ('3SAXJF92','UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
    v_pending := v_pending || jsonb_build_array(
      jsonb_build_object('code','codigo_exemplo_invalido','label','Código demonstrativo inválido'),
      jsonb_build_object('code','sem_codigo','label','Sem código Monnera'));
  ELSIF v_codigo !~ '^[A-Z0-9]{8}$' THEN
    v_pending := v_pending || jsonb_build_array(
      jsonb_build_object('code','codigo_formato_nao_confirmado','label','Código em formato não confirmado'),
      jsonb_build_object('code','sem_codigo','label','Sem código Monnera'));
  END IF;

  IF jsonb_array_length(coalesce(p_row.conflict_notes,'[]'::jsonb)) > 0 THEN
    v_pending := v_pending || jsonb_build_array(jsonb_build_object('code','conflito_nova_mensagem','label','Conflito com nova mensagem'));
  END IF;

  IF jsonb_array_length(v_pending) = 0 THEN
    v_status := 'triage_ok';
  ELSIF v_pending @> '[{"code":"codigo_exemplo_invalido"}]'::jsonb THEN
    v_status := 'triage_codigo_exemplo_invalido';
  ELSIF v_pending @> '[{"code":"codigo_formato_nao_confirmado"}]'::jsonb THEN
    v_status := 'triage_codigo_formato_nao_confirmado';
  ELSIF v_pending @> '[{"code":"sem_cnpj"}]'::jsonb THEN
    v_status := 'triage_sem_cnpj';
  ELSIF v_pending @> '[{"code":"sem_nome"}]'::jsonb THEN
    v_status := 'triage_sem_nome';
  ELSE
    v_status := 'triage_sem_codigo';
  END IF;

  RETURN jsonb_build_object('pending_reasons', v_pending, 'analysis_result', v_status,
                            'cnpj', v_cnpj, 'nome', v_nome, 'codigo', v_codigo);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_gmail_triage_correction(
  p_row_id uuid,
  p_values jsonb,
  p_justification text,
  p_origin text DEFAULT 'manual',
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gmail_processed_messages;
  v_overrides jsonb;
  v_key text;
  v_new text;
  v_old text;
  v_calc jsonb;
  v_changed int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem corrigir registros de triagem.';
  END IF;
  IF coalesce(btrim(p_justification), '') = '' THEN
    RAISE EXCEPTION 'A justificativa é obrigatória.';
  END IF;

  SELECT * INTO v_row FROM public.gmail_processed_messages WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
  IF v_row.operational_status = 'liberado' THEN
    RAISE EXCEPTION 'Registro já liberado para operação: correções bloqueadas.';
  END IF;

  v_overrides := coalesce(v_row.manual_overrides, '{}'::jsonb);

  FOR v_key IN SELECT jsonb_object_keys(p_values) LOOP
    IF v_key NOT IN ('nome_parceiro','cnpj','email','telefone','codigo_monnera','responsavel','observacoes','pending_reason_manual') THEN
      RAISE EXCEPTION 'Campo não permitido: %', v_key;
    END IF;
    v_new := nullif(btrim(coalesce(p_values->>v_key, '')), '');

    v_old := CASE v_key
      WHEN 'responsavel' THEN v_row.responsavel
      WHEN 'observacoes' THEN v_row.observacoes
      WHEN 'pending_reason_manual' THEN v_row.pending_reason_manual
      WHEN 'codigo_monnera' THEN coalesce(v_overrides->>'codigo_monnera', v_row.codigo_encontrado)
      ELSE coalesce(v_overrides->>v_key, v_row.extracted->>v_key)
    END;

    IF coalesce(v_old,'') IS DISTINCT FROM coalesce(v_new,'') THEN
      v_changed := v_changed + 1;
      INSERT INTO public.gmail_triage_corrections
        (gmail_message_row_id, field, old_value, new_value, justification, origin, evidence, created_by)
      VALUES (p_row_id, v_key, v_old, v_new, btrim(p_justification), coalesce(p_origin,'manual'), coalesce(p_evidence,'{}'::jsonb), auth.uid());

      IF v_key = 'responsavel' THEN
        v_row.responsavel := v_new;
      ELSIF v_key = 'observacoes' THEN
        v_row.observacoes := v_new;
      ELSIF v_key = 'pending_reason_manual' THEN
        v_row.pending_reason_manual := v_new;
      ELSE
        v_overrides := jsonb_set(v_overrides, ARRAY[v_key], to_jsonb(coalesce(v_new,'')), true);
      END IF;
    END IF;
  END LOOP;

  IF v_changed = 0 THEN
    RETURN jsonb_build_object('changed', 0);
  END IF;

  v_row.manual_overrides := v_overrides;
  v_calc := public.gmail_triage_recompute(v_row);

  UPDATE public.gmail_processed_messages
     SET manual_overrides = v_overrides,
         responsavel = v_row.responsavel,
         observacoes = v_row.observacoes,
         pending_reason_manual = v_row.pending_reason_manual,
         pending_reasons = v_calc->'pending_reasons',
         analysis_result = v_calc->>'analysis_result',
         last_correction_at = now()
   WHERE id = p_row_id;

  RETURN jsonb_build_object('changed', v_changed, 'analysis_result', v_calc->>'analysis_result',
                            'pending_reasons', v_calc->'pending_reasons');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_gmail_triage_message(p_row_id uuid, p_justification text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gmail_processed_messages;
  v_calc jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem liberar registros.';
  END IF;
  IF coalesce(btrim(p_justification), '') = '' THEN
    RAISE EXCEPTION 'Confirme a liberação informando a justificativa.';
  END IF;

  SELECT * INTO v_row FROM public.gmail_processed_messages WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
  IF v_row.operational_status = 'liberado' THEN
    RETURN jsonb_build_object('already_released', true);
  END IF;
  IF NOT v_row.reviewed THEN
    RAISE EXCEPTION 'A revisão manual precisa estar aprovada antes da liberação.';
  END IF;

  v_calc := public.gmail_triage_recompute(v_row);
  IF v_calc->>'analysis_result' <> 'triage_ok'
     OR jsonb_array_length(v_calc->'pending_reasons') > 0 THEN
    RAISE EXCEPTION 'Registro possui pendências abertas e não pode ser liberado.';
  END IF;

  UPDATE public.gmail_processed_messages
     SET operational_status = 'liberado',
         analysis_result = 'triage_ok',
         pending_reasons = '[]'::jsonb,
         released_at = now(),
         released_by = auth.uid()
   WHERE id = p_row_id;

  INSERT INTO public.gmail_triage_corrections
    (gmail_message_row_id, field, old_value, new_value, justification, origin, created_by)
  VALUES (p_row_id, 'operational_status', 'bloqueado', 'liberado', btrim(p_justification), 'liberacao', auth.uid());

  RETURN jsonb_build_object('released', true);
END;
$$;
