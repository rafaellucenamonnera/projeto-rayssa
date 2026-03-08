-- Fix leads table: drop RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Admins and gestores read all leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
DROP POLICY IF EXISTS "Partners read own leads" ON public.leads;
DROP POLICY IF EXISTS "Gestores can update leads" ON public.leads;

CREATE POLICY "Admins and gestores read all leads" ON public.leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Partners read own leads" ON public.leads
  FOR SELECT TO authenticated
  USING (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can register leads" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(nome_fantasia) > 0 AND length(cnpj) > 0 AND length(nome_responsavel) > 0 AND length(email_responsavel) > 0
    AND parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE ativo = true)
  );

CREATE POLICY "Admins can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'gestor_conta'))
  WITH CHECK (has_role(auth.uid(), 'gestor_conta'));

-- Fix parceiros_comerciais table
DROP POLICY IF EXISTS "Admins read all parceiros" ON public.parceiros_comerciais;
DROP POLICY IF EXISTS "Partners read own record" ON public.parceiros_comerciais;
DROP POLICY IF EXISTS "Authenticated users register as parceiro" ON public.parceiros_comerciais;
DROP POLICY IF EXISTS "Parceiros can update own record" ON public.parceiros_comerciais;

CREATE POLICY "Admins read all parceiros" ON public.parceiros_comerciais
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Partners read own record" ON public.parceiros_comerciais
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users register as parceiro" ON public.parceiros_comerciais
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND length(nome) > 0 AND length(cpf) > 0 AND length(email) > 0);

CREATE POLICY "Parceiros can update own record" ON public.parceiros_comerciais
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix profiles table
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix user_roles table
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Fix links_parceiros table
DROP POLICY IF EXISTS "Admins read all links" ON public.links_parceiros;
DROP POLICY IF EXISTS "Partners read own links" ON public.links_parceiros;
DROP POLICY IF EXISTS "Partners insert own links" ON public.links_parceiros;

CREATE POLICY "Admins read all links" ON public.links_parceiros
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Partners read own links" ON public.links_parceiros
  FOR SELECT TO authenticated
  USING (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));

CREATE POLICY "Partners insert own links" ON public.links_parceiros
  FOR INSERT TO authenticated
  WITH CHECK (parceiro_id IN (SELECT id FROM parceiros_comerciais WHERE user_id = auth.uid()));