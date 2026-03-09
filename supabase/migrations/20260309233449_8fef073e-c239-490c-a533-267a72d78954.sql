
CREATE OR REPLACE FUNCTION public.validate_lead_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- CNPJ must be exactly 14 digits
  IF length(NEW.cnpj) <> 14 OR NEW.cnpj !~ '^\d{14}$' THEN
    RAISE EXCEPTION 'CNPJ inválido: deve conter exatamente 14 dígitos numéricos';
  END IF;

  -- Email basic format validation
  IF NEW.email_responsavel !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;

  -- Quantidade de lojas must be >= 1
  IF NEW.quantidade_lojas < 1 THEN
    RAISE EXCEPTION 'Quantidade de lojas deve ser ao menos 1';
  END IF;

  -- Field length limits to prevent abuse
  IF length(NEW.nome_fantasia) > 200 THEN
    RAISE EXCEPTION 'Nome fantasia excede 200 caracteres';
  END IF;

  IF length(NEW.razao_social) > 200 THEN
    RAISE EXCEPTION 'Razão social excede 200 caracteres';
  END IF;

  IF length(NEW.nome_responsavel) > 200 THEN
    RAISE EXCEPTION 'Nome do responsável excede 200 caracteres';
  END IF;

  IF length(NEW.email_responsavel) > 255 THEN
    RAISE EXCEPTION 'Email excede 255 caracteres';
  END IF;

  IF length(NEW.telefone_responsavel) > 30 THEN
    RAISE EXCEPTION 'Telefone excede 30 caracteres';
  END IF;

  IF length(NEW.cidade) > 200 THEN
    RAISE EXCEPTION 'Cidade excede 200 caracteres';
  END IF;

  IF length(NEW.erp_utilizado) > 200 THEN
    RAISE EXCEPTION 'ERP excede 200 caracteres';
  END IF;

  IF NEW.descricao_necessidade IS NOT NULL AND length(NEW.descricao_necessidade) > 500 THEN
    RAISE EXCEPTION 'Descrição excede 500 caracteres';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_lead_insert
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lead_insert();
