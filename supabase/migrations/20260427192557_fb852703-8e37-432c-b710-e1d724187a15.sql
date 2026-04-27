
-- 1) Remover INSERT público em leads e criar RPC segura para cadastro anônimo via link
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;

-- Partners autenticados podem inserir apenas leads vinculados ao próprio parceiro
CREATE POLICY "Partners insert own leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  parceiro_id IN (
    SELECT id FROM public.parceiros_comerciais WHERE user_id = auth.uid()
  )
);

-- Admins podem inserir qualquer lead
CREATE POLICY "Admins insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RPC pública para cadastro de leads via link de indicação (anon)
CREATE OR REPLACE FUNCTION public.register_lead_public(
  p_parceiro_id uuid,
  p_nome_responsavel text,
  p_telefone_responsavel text,
  p_email_responsavel text,
  p_nome_fantasia text,
  p_quantidade_lojas integer,
  p_erp_utilizado text,
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
  -- Validar parceiro ativo e aprovado
  IF NOT public.is_valid_parceiro(p_parceiro_id) THEN
    RAISE EXCEPTION 'Consultor inválido ou inativo';
  END IF;

  -- Validações básicas
  IF length(coalesce(p_nome_responsavel,'')) = 0
     OR length(coalesce(p_email_responsavel,'')) = 0
     OR length(coalesce(p_nome_fantasia,'')) = 0
     OR length(coalesce(p_telefone_responsavel,'')) = 0
     OR length(coalesce(p_erp_utilizado,'')) = 0
     OR coalesce(p_quantidade_lojas, 0) < 1 THEN
    RAISE EXCEPTION 'Dados obrigatórios ausentes';
  END IF;

  -- Restringir origem permitida via público
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
    p_quantidade_lojas,
    trim(p_erp_utilizado),
    p_valor_campanhas,
    p_origem
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_lead_public(uuid, text, text, text, text, integer, text, numeric, text) TO anon, authenticated;

-- 2) Anexar trigger de proteção contra self-approve em parceiros_comerciais
DROP TRIGGER IF EXISTS trg_prevent_partner_self_approve ON public.parceiros_comerciais;
CREATE TRIGGER trg_prevent_partner_self_approve
BEFORE UPDATE ON public.parceiros_comerciais
FOR EACH ROW
EXECUTE FUNCTION public.prevent_partner_self_approve();

-- 3) Anexar triggers já definidos como funções mas sem binding na tabela leads
DROP TRIGGER IF EXISTS trg_validate_lead_insert ON public.leads;
CREATE TRIGGER trg_validate_lead_insert
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.validate_lead_insert();

DROP TRIGGER IF EXISTS trg_track_lead_initial_stage ON public.leads;
CREATE TRIGGER trg_track_lead_initial_stage
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_lead_initial_stage();

DROP TRIGGER IF EXISTS trg_track_lead_stage_change ON public.leads;
CREATE TRIGGER trg_track_lead_stage_change
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_lead_stage_change();
