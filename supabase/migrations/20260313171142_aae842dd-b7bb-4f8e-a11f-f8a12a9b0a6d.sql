
-- Create a security definer function to validate parceiro for lead insert
CREATE OR REPLACE FUNCTION public.is_valid_parceiro(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parceiros_comerciais
    WHERE id = p_id AND ativo = true AND aprovado = true
  )
$$;

-- Drop old INSERT policy and recreate using the function
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;

CREATE POLICY "Anyone can register leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(nome_fantasia) > 0
  AND length(cnpj) > 0
  AND length(nome_responsavel) > 0
  AND length(email_responsavel) > 0
  AND public.is_valid_parceiro(parceiro_id)
);
