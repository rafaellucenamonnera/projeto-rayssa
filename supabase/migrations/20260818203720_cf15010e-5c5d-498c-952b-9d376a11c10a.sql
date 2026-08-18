
CREATE OR REPLACE FUNCTION public.link_source_to_card(
  p_card_id uuid,
  p_source text,
  p_source_record_id uuid DEFAULT NULL,
  p_thread_id text DEFAULT NULL,
  p_link_mode text DEFAULT 'manual',
  p_justification text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem vincular origens ao card';
  END IF;
  IF p_link_mode = 'manual' AND COALESCE(btrim(p_justification),'') = '' THEN
    RAISE EXCEPTION 'Justificativa obrigatória para vínculo manual';
  END IF;

  UPDATE public.card_source_links
     SET active = true, justification = COALESCE(p_justification, justification),
         unlinked_at = NULL, unlinked_by = NULL, unlink_justification = NULL
   WHERE card_id = p_card_id AND source = p_source
     AND source_record_id IS NOT DISTINCT FROM p_source_record_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO public.card_source_links (card_id, source, source_record_id, thread_id, link_mode, justification, created_by)
    VALUES (p_card_id, p_source, p_source_record_id, p_thread_id, p_link_mode, p_justification, auth.uid())
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.record_automation_run('vinculo_origem','sucesso', p_card_id, NULL, p_source,
    jsonb_build_object('link_id', v_id, 'mode', p_link_mode, 'thread_id', p_thread_id));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_source_from_card(
  p_link_id uuid,
  p_justification text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_card uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem desfazer vínculos';
  END IF;
  IF COALESCE(btrim(p_justification),'') = '' THEN
    RAISE EXCEPTION 'Justificativa obrigatória para desfazer vínculo';
  END IF;

  UPDATE public.card_source_links
     SET active = false, unlinked_at = now(), unlinked_by = auth.uid(), unlink_justification = p_justification
   WHERE id = p_link_id
  RETURNING card_id INTO v_card;

  IF v_card IS NULL THEN
    RAISE EXCEPTION 'Vínculo não encontrado';
  END IF;

  PERFORM public.record_automation_run('desvinculo_origem','sucesso', v_card, NULL, 'manual',
    jsonb_build_object('link_id', p_link_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.consolidate_source_into_card(
  p_card_id uuid,
  p_source text,
  p_source_record_id uuid,
  p_fields jsonb,
  p_evidence jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text;
  v text;
  v_current text;
  v_status text;
  v_consolidated jsonb := '[]'::jsonb;
  v_divergent jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem consolidar dados no card';
  END IF;

  FOR k, v IN SELECT key, value::text FROM jsonb_each_text(COALESCE(p_fields,'{}'::jsonb)) LOOP
    IF COALESCE(btrim(v),'') = '' THEN CONTINUE; END IF;

    EXECUTE format('SELECT (to_jsonb(t) ->> %L) FROM public.representative_cards t WHERE t.id = $1', k)
      INTO v_current USING p_card_id;

    IF v_current IS NULL OR btrim(v_current) = '' THEN
      EXECUTE format('UPDATE public.representative_cards SET %I = $1 WHERE id = $2', k) USING v, p_card_id;
      v_status := 'consolidado';
      v_consolidated := v_consolidated || jsonb_build_object('field', k, 'value', v);
    ELSIF lower(btrim(v_current)) = lower(btrim(v)) THEN
      v_status := 'consolidado';
      v_consolidated := v_consolidated || jsonb_build_object('field', k, 'value', v);
    ELSE
      v_status := 'divergente';
      v_divergent := v_divergent || jsonb_build_object('field', k, 'card_value', v_current, 'source_value', v);
    END IF;

    INSERT INTO public.card_field_provenance
      (card_id, field_name, field_value, source, source_record_id, evidence, status, created_by)
    VALUES (p_card_id, k, v, p_source, p_source_record_id,
            COALESCE(p_evidence ->> k, p_evidence ->> 'evidence'), v_status, auth.uid());
  END LOOP;

  PERFORM public.record_automation_run('consolidacao_origem',
    CASE WHEN jsonb_array_length(v_divergent) > 0 THEN 'duplicado' ELSE 'sucesso' END,
    p_card_id, NULL, p_source,
    jsonb_build_object('consolidados', v_consolidated, 'divergentes', v_divergent));

  RETURN jsonb_build_object('consolidados', v_consolidated, 'divergentes', v_divergent);
END;
$$;

REVOKE ALL ON FUNCTION public.link_source_to_card(uuid,text,uuid,text,text,text) FROM public;
REVOKE ALL ON FUNCTION public.unlink_source_from_card(uuid,text) FROM public;
REVOKE ALL ON FUNCTION public.consolidate_source_into_card(uuid,text,uuid,jsonb,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.link_source_to_card(uuid,text,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_source_from_card(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consolidate_source_into_card(uuid,text,uuid,jsonb,jsonb) TO authenticated;
