
-- Add new values to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'reuniao_realizada';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'lead_perdido';

-- Add motivo_perda and origem columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'link_indicacao';
