
-- 1. Leads: relax NOT NULL + new columns
ALTER TABLE public.leads
  ALTER COLUMN email_responsavel DROP NOT NULL,
  ALTER COLUMN quantidade_lojas DROP NOT NULL,
  ALTER COLUMN erp_utilizado DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS canal_tracao text,
  ADD COLUMN IF NOT EXISTS tipo_empresa text,
  ADD COLUMN IF NOT EXISTS numero_funcionarios integer,
  ADD COLUMN IF NOT EXISTS volume_premiacao_comissao numeric,
  ADD COLUMN IF NOT EXISTS modelo_campanha text,
  ADD COLUMN IF NOT EXISTS participantes_reuniao text,
  ADD COLUMN IF NOT EXISTS cargo_participante text,
  ADD COLUMN IF NOT EXISTS comissao_vitalicia boolean NOT NULL DEFAULT false;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_tipo_empresa_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_tipo_empresa_check
  CHECK (tipo_empresa IS NULL OR tipo_empresa IN ('varejo', 'distribuidor'));

-- 2. Reunioes: relax NOT NULL
ALTER TABLE public.reunioes
  ALTER COLUMN data_reuniao DROP NOT NULL,
  ALTER COLUMN horario_reuniao DROP NOT NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_canal_tracao ON public.leads (canal_tracao);
CREATE INDEX IF NOT EXISTS idx_leads_tipo_empresa ON public.leads (tipo_empresa);

-- 4. lead_tasks
CREATE TABLE IF NOT EXISTS public.lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid REFERENCES public.profiles(user_id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_tasks_status_check CHECK (status IN ('pendente', 'concluida'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tasks TO authenticated;
GRANT ALL ON public.lead_tasks TO service_role;

ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id_status
  ON public.lead_tasks (lead_id, status, due_date);

DROP POLICY IF EXISTS "Admins and gestores read lead tasks" ON public.lead_tasks;
CREATE POLICY "Admins and gestores read lead tasks"
ON public.lead_tasks
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
);

DROP POLICY IF EXISTS "Admins and gestores write lead tasks" ON public.lead_tasks;
CREATE POLICY "Admins and gestores write lead tasks"
ON public.lead_tasks
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
);

DROP TRIGGER IF EXISTS update_lead_tasks_updated_at ON public.lead_tasks;
CREATE TRIGGER update_lead_tasks_updated_at
BEFORE UPDATE ON public.lead_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. register_lead_public with 11 args
DROP FUNCTION IF EXISTS public.register_lead_public(uuid, text, text, text, text, integer, text, numeric, text);
DROP FUNCTION IF EXISTS public.register_lead_public(uuid, text, text, text, text, integer, text, numeric, text, text, text);

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

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_lead_public(uuid, text, text, text, text, integer, text, numeric, text, text, text) TO anon, authenticated;

-- 6. validate_lead_insert: NULL-safe email + quantidade_lojas
CREATE OR REPLACE FUNCTION public.validate_lead_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj <> '' THEN
    IF length(NEW.cnpj) <> 14 OR NEW.cnpj !~ '^\d{14}$' THEN
      RAISE EXCEPTION 'CNPJ inválido: deve conter exatamente 14 dígitos numéricos';
    END IF;
  END IF;

  IF NEW.email_responsavel IS NOT NULL AND NEW.email_responsavel <> '' THEN
    IF NEW.email_responsavel !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Email inválido';
    END IF;
  END IF;

  IF NEW.quantidade_lojas IS NOT NULL AND NEW.quantidade_lojas < 1 THEN
    RAISE EXCEPTION 'Quantidade de lojas deve ser ao menos 1';
  END IF;

  IF NEW.nome_fantasia IS NOT NULL AND length(NEW.nome_fantasia) > 200 THEN
    RAISE EXCEPTION 'Nome fantasia excede 200 caracteres';
  END IF;

  IF NEW.razao_social IS NOT NULL AND length(NEW.razao_social) > 200 THEN
    RAISE EXCEPTION 'Razão social excede 200 caracteres';
  END IF;

  IF NEW.nome_responsavel IS NOT NULL AND length(NEW.nome_responsavel) > 200 THEN
    RAISE EXCEPTION 'Nome do responsável excede 200 caracteres';
  END IF;

  IF NEW.email_responsavel IS NOT NULL AND length(NEW.email_responsavel) > 255 THEN
    RAISE EXCEPTION 'Email excede 255 caracteres';
  END IF;

  IF NEW.telefone_responsavel IS NOT NULL AND length(NEW.telefone_responsavel) > 30 THEN
    RAISE EXCEPTION 'Telefone excede 30 caracteres';
  END IF;

  IF NEW.cidade IS NOT NULL AND length(NEW.cidade) > 200 THEN
    RAISE EXCEPTION 'Cidade excede 200 caracteres';
  END IF;

  IF NEW.erp_utilizado IS NOT NULL AND length(NEW.erp_utilizado) > 200 THEN
    RAISE EXCEPTION 'ERP excede 200 caracteres';
  END IF;

  IF NEW.descricao_necessidade IS NOT NULL AND length(NEW.descricao_necessidade) > 500 THEN
    RAISE EXCEPTION 'Descrição excede 500 caracteres';
  END IF;

  RETURN NEW;
END;
$function$;
