-- Add financial fields and audit trail to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS valor_setup numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financeiro_preenchido_por uuid,
  ADD COLUMN IF NOT EXISTS financeiro_preenchido_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS financeiro_editado_por uuid,
  ADD COLUMN IF NOT EXISTS financeiro_editado_em timestamp with time zone;

-- Trigger to populate audit columns automatically when financial fields change
CREATE OR REPLACE FUNCTION public.audit_lead_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_changed boolean := false;
BEGIN
  -- Detect change in any of the financial fields
  IF (TG_OP = 'INSERT') THEN
    IF COALESCE(NEW.valor_setup,0) > 0
       OR COALESCE(NEW.valor_mensalidade,0) > 0
       OR COALESCE(NEW.valor_campanhas,0) > 0
       OR COALESCE(NEW.qtd_parcelas,0) > 0 THEN
      v_changed := true;
    END IF;
    IF v_changed AND v_uid IS NOT NULL THEN
      NEW.financeiro_preenchido_por := v_uid;
      NEW.financeiro_preenchido_em  := now();
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF COALESCE(NEW.valor_setup,0)         IS DISTINCT FROM COALESCE(OLD.valor_setup,0)
       OR COALESCE(NEW.valor_mensalidade,0) IS DISTINCT FROM COALESCE(OLD.valor_mensalidade,0)
       OR COALESCE(NEW.valor_campanhas,0)   IS DISTINCT FROM COALESCE(OLD.valor_campanhas,0)
       OR COALESCE(NEW.qtd_parcelas,0)      IS DISTINCT FROM COALESCE(OLD.qtd_parcelas,0)
       OR COALESCE(NEW.percentual_consultor,0) IS DISTINCT FROM COALESCE(OLD.percentual_consultor,0) THEN
      v_changed := true;
    END IF;
    IF v_changed AND v_uid IS NOT NULL THEN
      IF OLD.financeiro_preenchido_por IS NULL THEN
        NEW.financeiro_preenchido_por := v_uid;
        NEW.financeiro_preenchido_em  := now();
      ELSE
        NEW.financeiro_editado_por := v_uid;
        NEW.financeiro_editado_em  := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_lead_financeiro ON public.leads;
CREATE TRIGGER trg_audit_lead_financeiro
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.audit_lead_financeiro();