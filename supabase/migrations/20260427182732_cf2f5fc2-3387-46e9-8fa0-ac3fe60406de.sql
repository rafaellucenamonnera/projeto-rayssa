-- Drop overly-permissive anon policies on leads
DROP POLICY IF EXISTS "Anon read lead via token" ON public.leads;
DROP POLICY IF EXISTS "Anon complete lead via token" ON public.leads;

-- Drop overly-permissive anon policies on lojas
DROP POLICY IF EXISTS "Anon read lojas for conversion" ON public.lojas;
DROP POLICY IF EXISTS "Anon insert lojas via token" ON public.lojas;

-- SECURITY DEFINER: fetch a single lead by its completion token
CREATE OR REPLACE FUNCTION public.get_lead_by_completion_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  nome_fantasia text,
  razao_social text,
  cidade text,
  endereco_rua text,
  endereco_numero text,
  endereco_estado text,
  endereco_cep text,
  quantidade_lojas integer,
  nome_responsavel text,
  telefone_responsavel text,
  email_responsavel text,
  responsavel_tecnico_nome text,
  responsavel_tecnico_telefone text,
  responsavel_tecnico_email text,
  responsavel_comercial_nome text,
  responsavel_comercial_telefone text,
  responsavel_comercial_email text,
  responsavel_rh_nome text,
  responsavel_rh_telefone text,
  responsavel_rh_email text,
  dados_completos boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.nome_fantasia,
    l.razao_social,
    l.cidade,
    l.endereco_rua,
    l.endereco_numero,
    l.endereco_estado,
    l.endereco_cep,
    l.quantidade_lojas,
    l.nome_responsavel,
    l.telefone_responsavel,
    l.email_responsavel,
    l.responsavel_tecnico_nome,
    l.responsavel_tecnico_telefone,
    l.responsavel_tecnico_email,
    l.responsavel_comercial_nome,
    l.responsavel_comercial_telefone,
    l.responsavel_comercial_email,
    l.responsavel_rh_nome,
    l.responsavel_rh_telefone,
    l.responsavel_rh_email,
    l.dados_completos
  FROM public.leads l
  WHERE l.completion_token = p_token
    AND l.dados_completos = false
  LIMIT 1;
$$;

-- SECURITY DEFINER: complete a lead and (optionally) insert its lojas
CREATE OR REPLACE FUNCTION public.complete_lead_by_token(
  p_token uuid,
  p_data jsonb,
  p_lojas jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_qtd integer;
  v_loja jsonb;
BEGIN
  -- Locate lead by token; only pending ones
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE completion_token = p_token AND dados_completos = false
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou já utilizado';
  END IF;

  v_qtd := COALESCE((p_data->>'quantidade_lojas')::integer, 1);

  -- Update only the whitelisted columns
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

  -- Insert lojas if provided
  IF jsonb_array_length(p_lojas) > 0 THEN
    FOR v_loja IN SELECT * FROM jsonb_array_elements(p_lojas)
    LOOP
      INSERT INTO public.lojas (lead_id, cnpj, razao_social, nome_interno)
      VALUES (
        v_lead_id,
        v_loja->>'cnpj',
        v_loja->>'razao_social',
        v_loja->>'nome_interno'
      );
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

-- Allow anon + authenticated to call these RPCs
GRANT EXECUTE ON FUNCTION public.get_lead_by_completion_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lead_by_token(uuid, jsonb, jsonb) TO anon, authenticated;