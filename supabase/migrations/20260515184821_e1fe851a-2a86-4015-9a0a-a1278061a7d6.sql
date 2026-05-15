ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_be_responsible boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET can_be_responsible = true
WHERE p.can_be_responsible = false
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
      AND ur.role IN ('admin'::public.app_role, 'gestor_conta'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.get_available_responsible_users()
RETURNS TABLE (user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.nome
  FROM public.profiles p
  WHERE p.ativo = true
    AND p.can_be_responsible = true
  ORDER BY p.nome;
$$;

CREATE OR REPLACE FUNCTION public.validate_responsible_user_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.responsible_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = NEW.responsible_user_id
      AND p.ativo = true
      AND p.can_be_responsible = true
  ) THEN
    RAISE EXCEPTION 'Usuário selecionado não possui permissão para ser responsável.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_leads_responsible_user_eligibility ON public.leads;
CREATE TRIGGER trg_validate_leads_responsible_user_eligibility
BEFORE INSERT OR UPDATE OF responsible_user_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.validate_responsible_user_eligibility();

DROP TRIGGER IF EXISTS trg_validate_representative_cards_responsible_user_eligibility ON public.representative_cards;
CREATE TRIGGER trg_validate_representative_cards_responsible_user_eligibility
BEFORE INSERT OR UPDATE OF responsible_user_id ON public.representative_cards
FOR EACH ROW
EXECUTE FUNCTION public.validate_responsible_user_eligibility();