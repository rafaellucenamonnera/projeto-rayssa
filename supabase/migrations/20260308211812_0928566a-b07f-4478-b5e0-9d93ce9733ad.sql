-- 1. Add email format CHECK constraint on leads
ALTER TABLE public.leads ADD CONSTRAINT leads_email_format
  CHECK (email_responsavel ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- 2. Add CNPJ length constraint (must have exactly 14 digits)
ALTER TABLE public.leads ADD CONSTRAINT leads_cnpj_length
  CHECK (length(regexp_replace(cnpj, '\D', '', 'g')) = 14);