
-- Remove overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can read parceiros" ON public.parceiros_comerciais;

-- Public: only active partners visible (lead form needs id, nome, slug, codigo)
CREATE POLICY "Public lookup active parceiros" ON public.parceiros_comerciais
  FOR SELECT TO anon
  USING (ativo = true);

-- Authenticated partners see their own record
CREATE POLICY "Partners read own record" ON public.parceiros_comerciais
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins and gestores see all
CREATE POLICY "Admins read all parceiros" ON public.parceiros_comerciais
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));
