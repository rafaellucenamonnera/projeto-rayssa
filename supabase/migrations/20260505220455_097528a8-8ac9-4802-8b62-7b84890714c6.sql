CREATE OR REPLACE FUNCTION public.complete_lead_by_token(p_token uuid, p_data jsonb, p_lojas jsonb DEFAULT '[]'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid;
  v_qtd integer;
  v_loja jsonb;
  v_lojas_count integer;
  v_cnpj text;
BEGIN
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE completion_token = p_token AND dados_completos = false
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou já utilizado';
  END IF;

  v_qtd := COALESCE((p_data->>'quantidade_lojas')::integer, 1);

  -- Bound the lojas array to prevent abuse
  v_lojas_count := jsonb_array_length(p_lojas);
  IF v_lojas_count > 100 THEN
    RAISE EXCEPTION 'Número de lojas excede o limite permitido (máx. 100)';
  END IF;

  UPDATE public.leads SET
    nome_fantasia                  = COALESCE(p_data->>'nome_fantasia', nome_fantasia),
    razao_social                   = COALESCE(p_data->>'razao_social', razao_social),
    cidade                         = COALESCE(p_data->>'cidade', cidade),
    endereco_rua                   = COALESCE(p_data->>'endereco_rua', endereco_rua),
    endereco_numero                = COALESCE(p_data->>'endereco_numero', endereco_numero),
    endereco_estado                = COALESCE(p_data->>'endereco_estado', endereco_estado),
    endereco_cep                   = COALESCE(p_data->>'endereco_cep', endereco_cep),
    quantidade_lojas               = v_qtd,
    nome_responsavel               = COALESCE(p_data->>'nome_responsavel', nome_responsavel),
    telefone_responsavel           = COALESCE(p_data->>'telefone_responsavel', telefone_responsavel),
    email_responsavel              = COALESCE(p_data->>'email_responsavel', email_responsavel),
    responsavel_tecnico_nome       = COALESCE(p_data->>'responsavel_tecnico_nome', responsavel_tecnico_nome),
    responsavel_tecnico_telefone   = COALESCE(p_data->>'responsavel_tecnico_telefone', responsavel_tecnico_telefone),
    responsavel_tecnico_email      = COALESCE(p_data->>'responsavel_tecnico_email', responsavel_tecnico_email),
    responsavel_comercial_nome     = COALESCE(p_data->>'responsavel_comercial_nome', responsavel_comercial_nome),
    responsavel_comercial_telefone = COALESCE(p_data->>'responsavel_comercial_telefone', responsavel_comercial_telefone),
    responsavel_comercial_email    = COALESCE(p_data->>'responsavel_comercial_email', responsavel_comercial_email),
    responsavel_rh_nome            = COALESCE(p_data->>'responsavel_rh_nome', responsavel_rh_nome),
    responsavel_rh_telefone        = COALESCE(p_data->>'responsavel_rh_telefone', responsavel_rh_telefone),
    responsavel_rh_email           = COALESCE(p_data->>'responsavel_rh_email', responsavel_rh_email),
    dados_completos                = true
  WHERE id = v_lead_id;

  IF v_lojas_count > 0 THEN
    FOR v_loja IN SELECT * FROM jsonb_array_elements(p_lojas)
    LOOP
      v_cnpj := regexp_replace(COALESCE(v_loja->>'cnpj',''), '\D', '', 'g');
      IF v_cnpj <> '' AND length(v_cnpj) <> 14 THEN
        RAISE EXCEPTION 'CNPJ inválido na lista de lojas: deve conter 14 dígitos';
      END IF;

      INSERT INTO public.lojas (lead_id, cnpj, razao_social, nome_interno)
      VALUES (
        v_lead_id,
        v_cnpj,
        left(COALESCE(v_loja->>'razao_social',''), 255),
        left(COALESCE(v_loja->>'nome_interno',''), 200)
      );
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'lead_id', v_lead_id);
END;
$function$;