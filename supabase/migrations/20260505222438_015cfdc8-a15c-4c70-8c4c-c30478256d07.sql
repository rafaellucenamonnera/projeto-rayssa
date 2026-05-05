
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS valor_pagamento numeric;

CREATE OR REPLACE FUNCTION public.calc_lead_revenue_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.revenue_total :=
    COALESCE(NEW.valor_mensalidade, 0)
    + COALESCE(NEW.valor_campanhas, 0)
    + COALESCE(NEW.valor_pagamento, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_lead_revenue_total ON public.leads;
CREATE TRIGGER trg_calc_lead_revenue_total
BEFORE INSERT OR UPDATE OF valor_mensalidade, valor_campanhas, valor_pagamento
ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.calc_lead_revenue_total();

UPDATE public.leads
SET revenue_total =
  COALESCE(valor_mensalidade, 0)
  + COALESCE(valor_campanhas, 0)
  + COALESCE(valor_pagamento, 0);
