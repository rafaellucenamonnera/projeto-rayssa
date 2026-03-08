
-- Create a secure RPC for public partner lookup (returns only non-sensitive fields)
CREATE OR REPLACE FUNCTION public.lookup_parceiro_by_slug(slug text)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome FROM public.parceiros_comerciais
  WHERE slug_consultor = slug AND ativo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lookup_parceiro_by_code(code text)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome FROM public.parceiros_comerciais
  WHERE codigo_parceiro = code AND ativo = true
  LIMIT 1;
$$;

-- Now restrict anon SELECT to prevent direct table access
DROP POLICY IF EXISTS "Public lookup active parceiros" ON public.parceiros_comerciais;
