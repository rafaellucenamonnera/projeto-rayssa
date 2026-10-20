ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cadastro_cliente_data jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cadastro_cliente_recebido_at timestamptz;
ALTER TABLE public.leads ALTER COLUMN completion_token SET DEFAULT gen_random_uuid();
COMMENT ON COLUMN public.leads.cadastro_cliente_data IS 'Snapshot of client registration linked to the existing card; stores remain in public.lojas.';

CREATE OR REPLACE FUNCTION public.ensure_lead_completion_token(p_lead_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT completion_token INTO v_token FROM public.leads l
  WHERE l.id = p_lead_id AND coalesce(l.panel_id,'comercial') IN ('comercial','comerc')
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_conta')
      OR EXISTS (SELECT 1 FROM public.parceiros_comerciais pc WHERE pc.id=l.parceiro_id AND pc.user_id=auth.uid()))
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card não encontrado ou sem permissão'; END IF;
  IF v_token IS NULL THEN
    v_token := gen_random_uuid();
    PERFORM set_config('app.system_lead_update','on',true);
    UPDATE public.leads SET completion_token=v_token WHERE id=p_lead_id;
    PERFORM set_config('app.system_lead_update','',true);
  END IF;
  RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION public.ensure_lead_completion_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_lead_completion_token(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_lead_by_token(p_token uuid, p_data jsonb, p_lojas jsonb DEFAULT '[]'::jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lead_id uuid; v_qtd integer; v_loja jsonb; v_count integer; v_cnpj text; v_key text; v_data jsonb := '{}'::jsonb;
BEGIN
  SELECT id INTO v_lead_id FROM public.leads WHERE completion_token=p_token AND dados_completos=false FOR UPDATE;
  IF v_lead_id IS NULL THEN RAISE EXCEPTION 'Token inválido ou já utilizado'; END IF;
  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR jsonb_typeof(p_lojas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados de cadastro inválidos';
  END IF;
  v_qtd := coalesce((p_data->>'quantidade_lojas')::integer,1);
  v_count := jsonb_array_length(p_lojas);
  IF v_qtd < 1 OR v_qtd > 100 OR v_count > 100 THEN RAISE EXCEPTION 'Informe entre 1 e 100 lojas'; END IF;
  IF (v_qtd>1 AND v_count<>v_qtd) OR (v_qtd=1 AND v_count>1) THEN RAISE EXCEPTION 'Quantidade de lojas divergente do cadastro'; END IF;
  FOREACH v_key IN ARRAY ARRAY['nome_fantasia','razao_social','cidade','endereco_rua','endereco_numero','endereco_estado','endereco_cep','nome_responsavel','telefone_responsavel','email_responsavel','responsavel_tecnico_nome','responsavel_tecnico_telefone','responsavel_tecnico_email','responsavel_comercial_nome','responsavel_comercial_telefone','responsavel_comercial_email','responsavel_rh_nome','responsavel_rh_telefone','responsavel_rh_email'] LOOP
    IF nullif(btrim(p_data->>v_key),'') IS NULL THEN RAISE EXCEPTION 'Campo obrigatório não preenchido: %',v_key; END IF;
    v_data := v_data || jsonb_build_object(v_key,btrim(p_data->>v_key));
  END LOOP;
  v_data := v_data || jsonb_build_object('quantidade_lojas',v_qtd);
  FOREACH v_key IN ARRAY ARRAY['email_responsavel','responsavel_tecnico_email','responsavel_comercial_email','responsavel_rh_email'] LOOP
    IF (v_data->>v_key) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Email inválido'; END IF;
  END LOOP;
  FOR v_loja IN SELECT value FROM jsonb_array_elements(p_lojas) LOOP
    v_cnpj := regexp_replace(coalesce(v_loja->>'cnpj',''),'\D','','g');
    IF length(v_cnpj)<>14 OR nullif(btrim(v_loja->>'razao_social'),'') IS NULL OR nullif(btrim(v_loja->>'nome_interno'),'') IS NULL THEN
      RAISE EXCEPTION 'Dados de loja inválidos';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT regexp_replace(value->>'cnpj','\D','','g')) FROM jsonb_array_elements(p_lojas)) <> v_count THEN
    RAISE EXCEPTION 'CNPJ repetido';
  END IF;
  UPDATE public.leads SET
    nome_fantasia=v_data->>'nome_fantasia', razao_social=v_data->>'razao_social', cidade=v_data->>'cidade',
    endereco_rua=v_data->>'endereco_rua', endereco_numero=v_data->>'endereco_numero', endereco_estado=upper(v_data->>'endereco_estado'), endereco_cep=v_data->>'endereco_cep',
    quantidade_lojas=v_qtd, nome_responsavel=v_data->>'nome_responsavel', telefone_responsavel=v_data->>'telefone_responsavel', email_responsavel=lower(v_data->>'email_responsavel'),
    responsavel_tecnico_nome=v_data->>'responsavel_tecnico_nome',responsavel_tecnico_telefone=v_data->>'responsavel_tecnico_telefone',responsavel_tecnico_email=lower(v_data->>'responsavel_tecnico_email'),
    responsavel_comercial_nome=v_data->>'responsavel_comercial_nome',responsavel_comercial_telefone=v_data->>'responsavel_comercial_telefone',responsavel_comercial_email=lower(v_data->>'responsavel_comercial_email'),
    responsavel_rh_nome=v_data->>'responsavel_rh_nome',responsavel_rh_telefone=v_data->>'responsavel_rh_telefone',responsavel_rh_email=lower(v_data->>'responsavel_rh_email'),
    dados_completos=true, cadastro_cliente_data=v_data, cadastro_cliente_recebido_at=now()
  WHERE id=v_lead_id;
  FOR v_loja IN SELECT value FROM jsonb_array_elements(p_lojas) LOOP
    v_cnpj := regexp_replace(v_loja->>'cnpj','\D','','g');
    UPDATE public.lojas SET razao_social=left(btrim(v_loja->>'razao_social'),255),nome_interno=left(btrim(v_loja->>'nome_interno'),200)
      WHERE lead_id=v_lead_id AND cnpj=v_cnpj;
    IF NOT FOUND THEN
      INSERT INTO public.lojas(lead_id,cnpj,razao_social,nome_interno)
      VALUES(v_lead_id,v_cnpj,left(btrim(v_loja->>'razao_social'),255),left(btrim(v_loja->>'nome_interno'),200));
    END IF;
  END LOOP;
  RETURN json_build_object('success',true,'lead_id',v_lead_id);
END $$;
REVOKE ALL ON FUNCTION public.complete_lead_by_token(uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_lead_by_token(uuid,jsonb,jsonb) TO anon,authenticated,service_role;