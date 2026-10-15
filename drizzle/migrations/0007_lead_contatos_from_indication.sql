CREATE OR REPLACE FUNCTION public.register_lead_public(
  p_parceiro_id uuid,
  p_nome_responsavel text,
  p_telefone_responsavel text,
  p_email_responsavel text,
  p_nome_fantasia text,
  p_quantidade_lojas integer DEFAULT NULL,
  p_erp_utilizado text DEFAULT NULL,
  p_valor_campanhas numeric DEFAULT NULL,
  p_origem text DEFAULT 'link_indicacao',
  p_canal_tracao text DEFAULT NULL,
  p_tipo_empresa text DEFAULT NULL
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
    nome_fantasia, quantidade_lojas, erp_utilizado, valor_campanhas, origem,
    canal_tracao, tipo_empresa
  ) VALUES (
    p_parceiro_id,
    trim(p_nome_responsavel),
    trim(p_telefone_responsavel),
    lower(trim(p_email_responsavel)),
    trim(p_nome_fantasia),
    greatest(coalesce(p_quantidade_lojas, 1), 1),
    coalesce(nullif(trim(coalesce(p_erp_utilizado, '')), ''), 'Nao informado'),
    p_valor_campanhas,
    p_origem,
    nullif(trim(coalesce(p_canal_tracao, '')), ''),
    CASE WHEN p_tipo_empresa IN ('varejo', 'distribuidor') THEN p_tipo_empresa ELSE NULL END
  )
  RETURNING id INTO v_lead_id;

  INSERT INTO public.lead_contatos (lead_id, nome, email, telefone, principal)
  VALUES (
    v_lead_id,
    trim(p_nome_responsavel),
    lower(trim(p_email_responsavel)),
    trim(p_telefone_responsavel),
    true
  );

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_lead_public(uuid, text, text, text, text, integer, text, numeric, text, text, text) TO anon, authenticated;

INSERT INTO public.lead_contatos (lead_id, nome, email, telefone, principal)
SELECT l.id, l.nome_responsavel, l.email_responsavel, l.telefone_responsavel, true
FROM public.leads l
WHERE l.nome_responsavel IS NOT NULL
  AND btrim(l.nome_responsavel) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.lead_contatos c WHERE c.lead_id = l.id);