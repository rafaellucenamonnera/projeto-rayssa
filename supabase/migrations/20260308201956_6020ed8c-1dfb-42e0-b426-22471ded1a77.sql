
-- Scope leads INSERT: require all mandatory fields are non-empty (prevents empty/garbage inserts)
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;
CREATE POLICY "Anyone can register leads" ON public.leads
  FOR INSERT
  WITH CHECK (
    length(nome_fantasia) > 0 AND
    length(cnpj) > 0 AND
    length(nome_responsavel) > 0 AND
    length(email_responsavel) > 0 AND
    parceiro_id IN (SELECT id FROM public.parceiros_comerciais WHERE ativo = true)
  );

-- Scope parceiros INSERT: only allow insert when setting own user_id (authenticated) or null user_id
DROP POLICY IF EXISTS "Anyone can register as parceiro" ON public.parceiros_comerciais;
CREATE POLICY "Authenticated users register as parceiro" ON public.parceiros_comerciais
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    length(nome) > 0 AND
    length(cpf) > 0 AND
    length(email) > 0
  );
