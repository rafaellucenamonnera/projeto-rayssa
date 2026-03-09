
-- Add aprovado column defaulting to false
ALTER TABLE public.parceiros_comerciais ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;

-- Update the lead insert RLS to only allow leads for approved consultants
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;
CREATE POLICY "Anyone can register leads" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (length(nome_fantasia) > 0) AND (length(cnpj) > 0) AND (length(nome_responsavel) > 0) AND (length(email_responsavel) > 0)
    AND (parceiro_id IN (SELECT id FROM public.parceiros_comerciais WHERE ativo = true AND aprovado = true))
  );

-- Update lookup functions to only return approved consultants
CREATE OR REPLACE FUNCTION public.lookup_parceiro_by_slug(slug text)
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT id, nome FROM public.parceiros_comerciais
  WHERE slug_consultor = slug AND ativo = true AND aprovado = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lookup_parceiro_by_code(code text)
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT id, nome FROM public.parceiros_comerciais
  WHERE codigo_parceiro = code AND ativo = true AND aprovado = true
  LIMIT 1;
$$;
