ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_tipo_empresa_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_tipo_empresa_check
  CHECK (tipo_empresa IS NULL OR tipo_empresa IN ('varejo', 'distribuidor', 'industria'));
