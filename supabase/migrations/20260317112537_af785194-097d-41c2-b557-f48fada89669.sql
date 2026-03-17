
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS responsavel_tecnico_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_tecnico_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_tecnico_email text,
  ADD COLUMN IF NOT EXISTS responsavel_comercial_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_comercial_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_comercial_email text,
  ADD COLUMN IF NOT EXISTS responsavel_rh_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_rh_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_rh_email text,
  ADD COLUMN IF NOT EXISTS data_contrato_assinado timestamp with time zone;
