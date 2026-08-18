-- Modo de teste (QA) para cards do painel Cross
ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigo_teste boolean NOT NULL DEFAULT false;

ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.triage_activation_executions
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

-- Marca exclusivamente o card de QA
UPDATE public.representative_cards
   SET test_mode = true
 WHERE id = '32d1e94e-ab53-42b3-9118-ab3ad2d07c77';

-- Bloqueia o código fictício de QA em qualquer card real
CREATE OR REPLACE FUNCTION public.apply_monnera_code_to_card(
  p_card_id uuid, p_codigo text, p_source text DEFAULT 'gmail_jira'::text,
  p_evidence jsonb DEFAULT '{}'::jsonb, p_jira_issue_key text DEFAULT NULL::text)
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

  IF v_code IN ('3SAXJF92','UB5PXGDB','XXXXXXX','XXXXXXXX') THEN
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