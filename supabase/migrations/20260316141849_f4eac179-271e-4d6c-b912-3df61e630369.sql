
-- 1. Make razao_social, cnpj, cidade nullable in leads (for simplified capture)
ALTER TABLE public.leads ALTER COLUMN razao_social DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN cnpj DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN cidade DROP NOT NULL;

-- Set defaults for these columns
ALTER TABLE public.leads ALTER COLUMN razao_social SET DEFAULT '';
ALTER TABLE public.leads ALTER COLUMN cnpj SET DEFAULT '';
ALTER TABLE public.leads ALTER COLUMN cidade SET DEFAULT '';

-- 2. Add completion_token for conversion form link
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS completion_token uuid UNIQUE DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS dados_completos boolean NOT NULL DEFAULT false;

-- 3. Create lojas table for multiple stores
CREATE TABLE public.lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  nome_interno text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

-- RLS: Admins and gestores can manage lojas
CREATE POLICY "Admins and gestores read all lojas"
  ON public.lojas FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Admins manage lojas"
  ON public.lojas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Anyone with a valid completion_token can insert lojas (via conversion form)
CREATE POLICY "Anon insert lojas via token"
  ON public.lojas FOR INSERT TO anon, authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE completion_token IS NOT NULL AND dados_completos = false
    )
  );

-- Anon can read lojas for leads with active completion tokens
CREATE POLICY "Anon read lojas for conversion"
  ON public.lojas FOR SELECT TO anon, authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE completion_token IS NOT NULL AND dados_completos = false
    )
  );

-- Partners can read lojas for their own leads
CREATE POLICY "Partners read own lead lojas"
  ON public.lojas FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT l.id FROM leads l
      JOIN parceiros_comerciais p ON p.id = l.parceiro_id
      WHERE p.user_id = auth.uid()
    )
  );

-- 4. Update validate_lead_insert trigger to handle nullable fields
CREATE OR REPLACE FUNCTION public.validate_lead_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  -- CNPJ validation only if provided
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj <> '' THEN
    IF length(NEW.cnpj) <> 14 OR NEW.cnpj !~ '^\d{14}$' THEN
      RAISE EXCEPTION 'CNPJ inválido: deve conter exatamente 14 dígitos numéricos';
    END IF;
  END IF;

  -- Email basic format validation
  IF NEW.email_responsavel !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;

  -- Quantidade de lojas must be >= 1
  IF NEW.quantidade_lojas < 1 THEN
    RAISE EXCEPTION 'Quantidade de lojas deve ser ao menos 1';
  END IF;

  -- Field length limits
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

-- 5. Update RLS insert policy to remove cnpj requirement
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;
CREATE POLICY "Anyone can register leads"
  ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(nome_fantasia) > 0
    AND length(nome_responsavel) > 0
    AND length(email_responsavel) > 0
    AND is_valid_parceiro(parceiro_id)
  );

-- 6. Allow anon to update leads via completion_token (for conversion form)
CREATE POLICY "Anon complete lead via token"
  ON public.leads FOR UPDATE TO anon, authenticated
  USING (completion_token IS NOT NULL AND dados_completos = false)
  WITH CHECK (completion_token IS NOT NULL AND dados_completos = false);
