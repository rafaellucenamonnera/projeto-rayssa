
-- ============================================================
-- Recreate ALL RLS policies as PERMISSIVE (default)
-- ============================================================

-- === LEADS ===
DROP POLICY IF EXISTS "Admins and gestores read all leads" ON public.leads;
DROP POLICY IF EXISTS "Partners read own leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
DROP POLICY IF EXISTS "Gestores can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

CREATE POLICY "Admins and gestores read all leads" ON public.leads FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Partners read own leads" ON public.leads FOR SELECT TO authenticated
  USING (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can register leads" ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(nome_fantasia) > 0 AND length(cnpj) > 0 AND length(nome_responsavel) > 0 AND length(email_responsavel) > 0
    AND parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE ativo = true)
  );

CREATE POLICY "Admins can update leads" ON public.leads FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores can update leads" ON public.leads FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'gestor_conta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- === LINKS_PARCEIROS ===
DROP POLICY IF EXISTS "Admins read all links" ON public.links_parceiros;
DROP POLICY IF EXISTS "Partners read own links" ON public.links_parceiros;
DROP POLICY IF EXISTS "Partners insert own links" ON public.links_parceiros;

CREATE POLICY "Admins read all links" ON public.links_parceiros FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Partners read own links" ON public.links_parceiros FOR SELECT TO authenticated
  USING (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));

CREATE POLICY "Partners insert own links" ON public.links_parceiros FOR INSERT TO authenticated
  WITH CHECK (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));

-- === PAGAMENTOS_CONSULTORES ===
DROP POLICY IF EXISTS "Admins and gestores read all pagamentos" ON public.pagamentos_consultores;
DROP POLICY IF EXISTS "Partners read own pagamentos" ON public.pagamentos_consultores;
DROP POLICY IF EXISTS "Admins manage pagamentos" ON public.pagamentos_consultores;

CREATE POLICY "Admins and gestores read all pagamentos" ON public.pagamentos_consultores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Partners read own pagamentos" ON public.pagamentos_consultores FOR SELECT TO authenticated
  USING (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage pagamentos" ON public.pagamentos_consultores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- === PARCEIROS_COMERCIAIS ===
DROP POLICY IF EXISTS "Admins read all parceiros" ON public.parceiros_comerciais;
DROP POLICY IF EXISTS "Partners read own record" ON public.parceiros_comerciais;
DROP POLICY IF EXISTS "Authenticated users register as parceiro" ON public.parceiros_comerciais;
DROP POLICY IF EXISTS "Parceiros can update own record" ON public.parceiros_comerciais;
DROP POLICY IF EXISTS "Admins can delete parceiros" ON public.parceiros_comerciais;

CREATE POLICY "Admins read all parceiros" ON public.parceiros_comerciais FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Partners read own record" ON public.parceiros_comerciais FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users register as parceiro" ON public.parceiros_comerciais FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND length(nome) > 0 AND length(cpf) > 0 AND length(email) > 0);

CREATE POLICY "Parceiros can update own record" ON public.parceiros_comerciais FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can delete parceiros" ON public.parceiros_comerciais FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- === PROFILES ===
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- === USER_ROLES ===
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user_roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
