
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read leads" ON public.leads;

-- Partners can only read their own leads
CREATE POLICY "Partners read own leads" ON public.leads
  FOR SELECT TO authenticated
  USING (parceiro_id IN (
    SELECT id FROM public.parceiros_comerciais WHERE user_id = auth.uid()
  ));

-- Admins and gestores can read all leads
CREATE POLICY "Admins and gestores read all leads" ON public.leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role));
