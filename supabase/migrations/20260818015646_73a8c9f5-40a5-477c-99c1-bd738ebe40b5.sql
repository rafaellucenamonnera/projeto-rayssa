-- ============================================================================
-- Painel Onb Clientes Cross — regra mínima de entrada + fluxo progressivo
-- ============================================================================

ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS pending_complement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS origin_source text,
  ADD COLUMN IF NOT EXISTS origin_message_id text,
  ADD COLUMN IF NOT EXISTS origin_thread_id text;

CREATE INDEX IF NOT EXISTS idx_repcards_origin_thread ON public.representative_cards (origin_thread_id);
CREATE INDEX IF NOT EXISTS idx_repcards_pending ON public.representative_cards (panel_id, pending_complement);

-- ---------------------------------------------------------------- helpers
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

  IF coalesce(btrim(v.full_name), '') = '' THEN
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

-- Valores normalizados de um registro de triagem (Gmail ou WhatsApp).
CREATE OR REPLACE FUNCTION public.triage_row_values(p_source text, p_row_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gmail public.gmail_processed_messages;
  v_wa record;
  v_calc jsonb;
  v_cnpj text; v_nome text; v_codigo text; v_cnpj_source text;
  v_email text; v_telefone text; v_message_id text; v_thread_id text;
  v_suggested uuid; v_evidence jsonb; v_pending jsonb := '[]'::jsonb;
  v_reviewed boolean := false; v_released boolean := false;
  v_rejected boolean := false;
  v_conflicts int := 0; v_candidates int := 0;
  v_origin_ok boolean := false;
BEGIN
  IF p_source = 'gmail' THEN
    SELECT * INTO v_gmail FROM public.gmail_processed_messages WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registro de triagem não encontrado.'; END IF;
    v_calc := public.gmail_triage_recompute(v_gmail);
    v_cnpj := regexp_replace(coalesce(v_calc->>'cnpj',''), '\D', '', 'g');
    v_nome := btrim(coalesce(v_calc->>'nome',''));
    v_codigo := upper(btrim(coalesce(v_calc->>'codigo','')));
    v_cnpj_source := coalesce(v_calc->>'cnpj_source', v_gmail.cnpj_source);
    v_message_id := v_gmail.message_id;
    v_thread_id := v_gmail.thread_id;
    v_email := nullif(btrim(coalesce(v_gmail.extracted->>'email', v_gmail.extracted->>'focal_email', '')), '');
    IF v_email IS NULL THEN
      v_email := nullif((regexp_match(coalesce(v_gmail.from_address,''), '[^ <>]+@[^ <>]+'))[1], '');
    END IF;
    v_telefone := nullif(btrim(coalesce(v_gmail.extracted->>'telefone', v_gmail.extracted->>'focal_phone','')), '');
    v_suggested := coalesce(v_gmail.representative_card_id, v_gmail.matched_card_id);
    v_pending := coalesce(v_calc->'triage_pending','[]'::jsonb);
    v_conflicts := jsonb_array_length(coalesce(v_gmail.conflict_notes,'[]'::jsonb));
    v_candidates := jsonb_array_length(coalesce(v_gmail.cnpj_candidates,'[]'::jsonb));
    v_rejected := coalesce(v_gmail.review_decision,'') ILIKE '%rejeit%';
    v_reviewed := coalesce(v_gmail.reviewed, false) AND NOT v_rejected;
    v_released := coalesce(v_gmail.operational_status,'') = 'liberado';
    v_origin_ok := coalesce(v_message_id,'') <> '' OR coalesce(v_thread_id,'') <> '';
    v_evidence := jsonb_build_object(
      'assunto', v_gmail.subject, 'remetente', v_gmail.from_address,
      'recebido_em', v_gmail.received_at, 'trecho', v_gmail.body_snippet,
      'cnpj_origem', v_cnpj_source, 'cnpj_trecho', v_gmail.cnpj_snippet,
      'thread_id', v_thread_id, 'message_id', v_message_id,
      'correcoes_manuais', v_gmail.manual_overrides);
  ELSIF p_source = 'whatsapp' THEN
    SELECT * INTO v_wa FROM public.whatsapp_extractions WHERE id = p_row_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Extração de WhatsApp não encontrada.'; END IF;
    v_cnpj := regexp_replace(coalesce(v_wa.cnpj,''), '\D', '', 'g');
    v_nome := btrim(coalesce(v_wa.cliente_nome,''));
    v_codigo := upper(btrim(coalesce(v_wa.codigo_monnera,'')));
    v_suggested := coalesce(v_wa.linked_card_id, v_wa.matched_card_id);
    v_cnpj_source := 'whatsapp';
    v_email := nullif(btrim(coalesce(v_wa.email,'')), '');
    v_telefone := nullif(btrim(coalesce(v_wa.telefone,'')), '');
    IF length(coalesce(v_cnpj,'')) <> 14 AND v_suggested IS NOT NULL THEN
      SELECT regexp_replace(coalesce(cnpj,''), '\D','','g') INTO v_cnpj
        FROM public.representative_cards WHERE id = v_suggested;
      IF length(coalesce(v_cnpj,'')) = 14 THEN v_cnpj_source := 'card_vinculado'; END IF;
    END IF;
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_pending
      FROM jsonb_array_elements(coalesce(v_wa.pending_reasons,'[]'::jsonb)) x
     WHERE coalesce(x->>'code','') NOT IN ('sem_codigo','codigo_exemplo_invalido','codigo_formato_nao_confirmado')
       AND NOT (coalesce(x->>'code','') = 'sem_cnpj' AND v_cnpj_source = 'card_vinculado');
    v_candidates := jsonb_array_length(coalesce(v_wa.cnpj_candidates,'[]'::jsonb));
    v_rejected := coalesce(v_wa.review_decision,'') NOT IN ('', 'aprovado');
    v_reviewed := coalesce(v_wa.reviewed,false) AND coalesce(v_wa.review_decision,'') = 'aprovado';
    v_released := v_reviewed;
    v_origin_ok := true;
    v_evidence := jsonb_build_object('extraction_id', v_wa.id, 'trechos', v_wa.evidences,
                                     'conversa_inicio', v_wa.conversation_started_at,
                                     'conversa_fim', v_wa.conversation_ended_at,
                                     'cnpj_origem', v_cnpj_source);
  ELSE
    RAISE EXCEPTION 'Origem inválida.';
  END IF;

  RETURN jsonb_build_object(
    'source', p_source, 'row_id', p_row_id,
    'nome', v_nome, 'cnpj', coalesce(v_cnpj,''), 'cnpj_source', v_cnpj_source,
    'codigo', v_codigo, 'email', v_email, 'telefone', v_telefone,
    'message_id', v_message_id, 'thread_id', v_thread_id,
    'card_sugerido', v_suggested, 'evidencia', v_evidence,
    'pendencias', v_pending, 'conflitos', v_conflicts, 'cnpj_candidatos', v_candidates,
    'revisado', v_reviewed, 'liberado', v_released, 'rejeitado', v_rejected,
    'origem_rastreavel', v_origin_ok);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cross_card_missing_fields(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.triage_row_values(text, uuid) TO authenticated, service_role;

-- --------------------------------------------------- reprocessamento/avanço
CREATE OR REPLACE FUNCTION public.reprocess_cross_card_completion(p_card_id uuid, p_reason text DEFAULT 'reprocessamento')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v public.representative_cards;
  v_missing jsonb;
  v_moved boolean := false;
  v_stage_cad text := 'etapa_painel_msj9fyji_1';
  v_stage_painel text := 'etapa_painel_msj9fyji_2';
BEGIN
  SELECT * INTO v FROM public.representative_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não encontrado.'; END IF;

  v_missing := public.cross_card_missing_fields(p_card_id);

  UPDATE public.representative_cards
     SET pending_fields = v_missing,
         pending_complement = jsonb_array_length(v_missing) > 0,
         updated_at = now()
   WHERE id = p_card_id;

  IF jsonb_array_length(v_missing) = 0
     AND v.stage_id = v_stage_cad
     AND NOT coalesce(v.is_blocked, false) THEN
    UPDATE public.representative_cards
       SET stage_id = v_stage_painel, updated_at = now()
     WHERE id = p_card_id;

    INSERT INTO public.representative_card_history
      (representative_card_id, actor_user_id, actor_label, action, source_stage_id, destination_stage_id, payload)
    VALUES (p_card_id, auth.uid(), 'Fluxo automático', 'stage_auto_moved_criacao_painel',
            v_stage_cad, v_stage_painel,
            jsonb_build_object('origem_etapa','Cadastro','destino_etapa','Criação Painel',
                               'regra','Requisitos mínimos atendidos: nome, CNPJ e e-mail de contato confirmados',
                               'motivo', p_reason));
    v_moved := true;
  END IF;

  RETURN jsonb_build_object(
    'card_id', p_card_id,
    'dados_faltantes', v_missing,
    'pendente', jsonb_array_length(v_missing) > 0,
    'avancou', v_moved,
    'etapa', CASE WHEN v_moved THEN v_stage_painel ELSE v.stage_id END);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reprocess_cross_card_completion(uuid, text) TO authenticated, service_role;

-- ------------------------------------------- complemento a partir da triagem
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
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem complementar o card.';
  END IF;

  v_vals := public.triage_row_values(p_source, p_row_id);
  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não encontrado.'; END IF;

  v_label := CASE WHEN p_source = 'gmail' THEN 'gmail_triage' ELSE 'whatsapp_triage' END;
  v_sources := coalesce(v_card.field_sources, '{}'::jsonb);

  IF coalesce(btrim(v_card.full_name),'') = '' AND coalesce(v_vals->>'nome','') <> '' THEN
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

GRANT EXECUTE ON FUNCTION public.complement_cross_card_from_triage(text, uuid, uuid) TO authenticated, service_role;