ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid NULL REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_leads_responsible_user_id
  ON public.leads (responsible_user_id);

DROP POLICY IF EXISTS "Admins and gestores read all leads" ON public.leads;
DROP POLICY IF EXISTS "Partners read own leads" ON public.leads;

CREATE POLICY "Admins read all leads"
ON public.leads FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Consultor and gestor read own/responsible leads"
ON public.leads FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gestor_conta'::app_role)
  OR parceiro_id IN (SELECT id FROM public.parceiros_comerciais WHERE user_id = auth.uid())
  OR responsible_user_id = auth.uid()
);