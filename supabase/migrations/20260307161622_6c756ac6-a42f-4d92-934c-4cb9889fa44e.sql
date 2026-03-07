
-- Add slug_consultor to parceiros_comerciais
ALTER TABLE public.parceiros_comerciais ADD COLUMN IF NOT EXISTS slug_consultor text UNIQUE;

-- Create function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_slug(name_input text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  exists_already BOOLEAN;
BEGIN
  base_slug := lower(trim(name_input));
  base_slug := translate(base_slug, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn');
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.parceiros_comerciais WHERE slug_consultor = final_slug) INTO exists_already;
    EXIT WHEN NOT exists_already;
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$$;

-- Generate slugs for existing parceiros
UPDATE public.parceiros_comerciais 
SET slug_consultor = public.generate_slug(nome) 
WHERE slug_consultor IS NULL;

-- Create enum for lead status
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('novo_lead', 'reuniao_agendada', 'proposta_comercial', 'lead_convertido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add status_lead column (keeping existing status column for backward compat)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status_lead public.lead_status NOT NULL DEFAULT 'novo_lead';

-- Update existing leads to set status_lead based on status text
UPDATE public.leads SET status_lead = 'novo_lead' WHERE status_lead IS NULL;

-- Allow admins and gestor_conta to update leads (for status changes)
CREATE POLICY "Admins can update leads" ON public.leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can update leads" ON public.leads FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'gestor_conta'))
WITH CHECK (public.has_role(auth.uid(), 'gestor_conta'));
