CREATE OR REPLACE FUNCTION public.complete_lead_by_token(p_token uuid, p_data jsonb, p_lojas jsonb DEFAULT '[]'::jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lead_id uuid; v_qtd integer; v_key text; v_data jsonb := '{}'::jsonb;
BEGIN
  SELECT id INTO v_lead_id FROM public.leads WHERE completion_token=p_token AND dados_completos=false FOR UPDATE;
  IF v_lead_id IS NULL THEN RAISE EXCEPTION 'Token inválido ou já utilizado'; END IF;
  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Dados de cadastro inválidos';
  END IF;
  v_qtd := coalesce((p_data->>'quantidade_lojas')::integer,1);
  IF v_qtd < 1 OR v_qtd > 10000 THEN RAISE EXCEPTION 'Informe entre 1 e 10000 lojas'; END IF;
  FOREACH v_key IN ARRAY ARRAY['nome_fantasia','razao_social','cidade','endereco_rua','endereco_numero','endereco_estado','endereco_cep','nome_responsavel','telefone_responsavel','email_responsavel','responsavel_tecnico_nome','responsavel_tecnico_telefone','responsavel_tecnico_email','responsavel_comercial_nome','responsavel_comercial_telefone','responsavel_comercial_email','responsavel_rh_nome','responsavel_rh_telefone','responsavel_rh_email'] LOOP
    IF nullif(btrim(p_data->>v_key),'') IS NULL THEN RAISE EXCEPTION 'Campo obrigatório não preenchido: %',v_key; END IF;
    v_data := v_data || jsonb_build_object(v_key,btrim(p_data->>v_key));
  END LOOP;
  v_data := v_data || jsonb_build_object('quantidade_lojas',v_qtd);
  FOREACH v_key IN ARRAY ARRAY['email_responsavel','responsavel_tecnico_email','responsavel_comercial_email','responsavel_rh_email'] LOOP
    IF (v_data->>v_key) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Email inválido'; END IF;
  END LOOP;
  UPDATE public.leads SET
    nome_fantasia=v_data->>'nome_fantasia', razao_social=v_data->>'razao_social', cidade=v_data->>'cidade',
    endereco_rua=v_data->>'endereco_rua', endereco_numero=v_data->>'endereco_numero', endereco_estado=upper(v_data->>'endereco_estado'), endereco_cep=v_data->>'endereco_cep',
    quantidade_lojas=v_qtd, nome_responsavel=v_data->>'nome_responsavel', telefone_responsavel=v_data->>'telefone_responsavel', email_responsavel=lower(v_data->>'email_responsavel'),
    responsavel_tecnico_nome=v_data->>'responsavel_tecnico_nome',responsavel_tecnico_telefone=v_data->>'responsavel_tecnico_telefone',responsavel_tecnico_email=lower(v_data->>'responsavel_tecnico_email'),
    responsavel_comercial_nome=v_data->>'responsavel_comercial_nome',responsavel_comercial_telefone=v_data->>'responsavel_comercial_telefone',responsavel_comercial_email=lower(v_data->>'responsavel_comercial_email'),
    responsavel_rh_nome=v_data->>'responsavel_rh_nome',responsavel_rh_telefone=v_data->>'responsavel_rh_telefone',responsavel_rh_email=lower(v_data->>'responsavel_rh_email'),
    dados_completos=true, cadastro_cliente_data=v_data, cadastro_cliente_recebido_at=now()
  WHERE id=v_lead_id;
  RETURN json_build_object('success',true,'lead_id',v_lead_id);
END $$;
REVOKE ALL ON FUNCTION public.complete_lead_by_token(uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_lead_by_token(uuid,jsonb,jsonb) TO anon,authenticated,service_role;