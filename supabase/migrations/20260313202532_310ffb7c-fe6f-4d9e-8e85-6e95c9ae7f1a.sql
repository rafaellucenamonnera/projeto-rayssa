
-- Add new pipeline stages to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contato_realizado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposta_enviada';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contrato_enviado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contrato_assinado';

-- Add contract-related columns to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS numero_proposta text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contrato_url text;
