CREATE OR REPLACE FUNCTION public.apply_monnera_code_to_card(
  p_card_id uuid,
  p_codigo text,
  p_source text DEFAULT 'gmail_jira',
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_jira_issue_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text := upper(btrim(coalesce(p_codigo,'')));
  v_card public.representative_cards;
  v_dup uuid;
  v_recipient uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem aplicar o código Monnera.';
  END IF;

  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não encontrado.'; END IF;

  IF v_code IN ('3SAXJF92','UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
    RAISE EXCEPTION 'Código demonstrativo inválido: %', v_code;
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
         codigo_source = coalesce(p_source, 'gmail_jira'),
         codigo_evidencia = coalesce(p_evidence, '{}'::jsonb),
         jira_issue_key = coalesce(p_jira_issue_key, jira_issue_key)
   WHERE id = p_card_id;

  INSERT INTO public.representative_card_history
    (representative_card_id, actor_user_id, actor_label, action, payload)
  VALUES (p_card_id, auth.uid(), 'Código Monnera', 'codigo_monnera_aplicado',
          jsonb_build_object('codigo', v_code, 'origem', p_source,
                             'jira_issue_key', p_jira_issue_key, 'evidencia', p_evidence));

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

  RETURN jsonb_build_object('applied', true, 'codigo', v_code, 'card_id', p_card_id);
END;
$function$;