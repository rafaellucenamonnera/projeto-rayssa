ALTER TABLE public.parceiros_comerciais
  ADD COLUMN IF NOT EXISTS cliente_monnera boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_monnera_cnpj text;

ALTER TABLE public.parceiros_comerciais
  DROP CONSTRAINT IF EXISTS parceiros_cliente_monnera_cnpj_required;

ALTER TABLE public.parceiros_comerciais
  ADD CONSTRAINT parceiros_cliente_monnera_cnpj_required
  CHECK (
    cliente_monnera = false
    OR length(regexp_replace(coalesce(cliente_monnera_cnpj, ''), '\D', '', 'g')) = 14
  );

CREATE OR REPLACE FUNCTION public.register_lead_public(
  p_parceiro_id uuid,
  p_nome_responsavel text,
  p_telefone_responsavel text,
  p_email_responsavel text,
  p_nome_fantasia text,
  p_quantidade_lojas integer DEFAULT NULL,
  p_erp_utilizado text DEFAULT NULL,
  p_valor_campanhas numeric DEFAULT NULL,
  p_origem text DEFAULT 'link_indicacao'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NOT public.is_valid_parceiro(p_parceiro_id) THEN
    RAISE EXCEPTION 'Consultor invalido ou inativo';
  END IF;

  IF length(coalesce(p_nome_responsavel,'')) = 0
     OR length(coalesce(p_email_responsavel,'')) = 0
     OR length(coalesce(p_nome_fantasia,'')) = 0
     OR length(coalesce(p_telefone_responsavel,'')) = 0 THEN
    RAISE EXCEPTION 'Dados obrigatorios ausentes';
  END IF;

  IF p_origem NOT IN ('link_indicacao') THEN
    p_origem := 'link_indicacao';
  END IF;

  INSERT INTO public.leads (
    parceiro_id, nome_responsavel, telefone_responsavel, email_responsavel,
    nome_fantasia, quantidade_lojas, erp_utilizado, valor_campanhas, origem
  ) VALUES (
    p_parceiro_id,
    trim(p_nome_responsavel),
    trim(p_telefone_responsavel),
    lower(trim(p_email_responsavel)),
    trim(p_nome_fantasia),
    greatest(coalesce(p_quantidade_lojas, 1), 1),
    coalesce(nullif(trim(coalesce(p_erp_utilizado, '')), ''), 'Nao informado'),
    p_valor_campanhas,
    p_origem
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_lead_public(uuid, text, text, text, text, integer, text, numeric, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.register_parceiro(uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.register_parceiro(
  p_user_id uuid,
  p_codigo_parceiro text,
  p_nome text,
  p_cpf text,
  p_email text,
  p_telefone_ddd text,
  p_telefone_numero text,
  p_slug_consultor text,
  p_cliente_monnera boolean DEFAULT false,
  p_cliente_monnera_cnpj text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  v_cliente_cnpj text;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Nao autorizado: user_id nao corresponde ao usuario autenticado';
  END IF;

  v_cliente_cnpj := regexp_replace(coalesce(p_cliente_monnera_cnpj, ''), '\D', '', 'g');

  IF coalesce(p_cliente_monnera, false) AND length(v_cliente_cnpj) <> 14 THEN
    RAISE EXCEPTION 'CNPJ de cliente Monnera invalido';
  END IF;

  INSERT INTO public.parceiros_comerciais (
    user_id, codigo_parceiro, nome, cpf, email, telefone_ddd, telefone_numero,
    slug_consultor, cliente_monnera, cliente_monnera_cnpj
  ) VALUES (
    p_user_id, p_codigo_parceiro, p_nome, p_cpf, p_email, p_telefone_ddd, p_telefone_numero,
    p_slug_consultor, coalesce(p_cliente_monnera, false), nullif(v_cliente_cnpj, '')
  )
  RETURNING json_build_object(
    'id', id,
    'nome', nome,
    'codigo_parceiro', codigo_parceiro,
    'slug_consultor', slug_consultor,
    'cliente_monnera', cliente_monnera,
    'cliente_monnera_cnpj', cliente_monnera_cnpj
  ) INTO result;

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.register_parceiro(uuid, text, text, text, text, text, text, text, boolean, text) TO authenticated;
