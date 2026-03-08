-- 1. Revoke public EXECUTE on has_role to prevent role enumeration
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;

-- 2. Drop overly permissive public SELECT on links_parceiros
DROP POLICY IF EXISTS "Anyone can read links" ON public.links_parceiros;

-- 3. Add scoped policy: partners read only their own links
CREATE POLICY "Partners read own links" ON public.links_parceiros
  FOR SELECT TO authenticated
  USING (parceiro_id IN (
    SELECT id FROM public.parceiros_comerciais WHERE user_id = auth.uid()
  ));

-- 4. Admins/gestores can also read all links
CREATE POLICY "Admins read all links" ON public.links_parceiros
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta'));