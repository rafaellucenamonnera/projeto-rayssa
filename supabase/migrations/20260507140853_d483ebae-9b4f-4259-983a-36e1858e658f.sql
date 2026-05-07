ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS consultor text,
  ADD COLUMN IF NOT EXISTS impacto text,
  ADD COLUMN IF NOT EXISTS risco text,
  ADD COLUMN IF NOT EXISTS csat numeric;