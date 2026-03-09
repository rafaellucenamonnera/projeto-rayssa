
-- 1. Fix pagamentos_consultores policies: recreate with TO authenticated
DROP POLICY IF EXISTS "Admins and gestores read all pagamentos" ON public.pagamentos_consultores;
DROP POLICY IF EXISTS "Partners read own pagamentos" ON public.pagamentos_consultores;
DROP POLICY IF EXISTS "Admins manage pagamentos" ON public.pagamentos_consultores;

CREATE POLICY "Admins and gestores read all pagamentos" ON public.pagamentos_consultores
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Partners read own pagamentos" ON public.pagamentos_consultores
  FOR SELECT TO authenticated
  USING (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage pagamentos" ON public.pagamentos_consultores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix function search_path on functions missing it
ALTER FUNCTION public.generate_partner_code() SET search_path = 'public';
ALTER FUNCTION public.get_financeiro_dashboard() SET search_path = 'public';
ALTER FUNCTION public.get_financeiro_consultores() SET search_path = 'public';
