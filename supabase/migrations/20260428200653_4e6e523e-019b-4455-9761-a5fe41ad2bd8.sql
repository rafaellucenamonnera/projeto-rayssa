-- 1. Remover trigger duplicado
DROP TRIGGER IF EXISTS prevent_partner_self_approve_trigger ON public.parceiros_comerciais;

-- 2. Substituir policy de self-update por uma que impede alterar campos sensíveis
DROP POLICY IF EXISTS "Parceiros can update own record" ON public.parceiros_comerciais;

CREATE POLICY "Parceiros update own contact info"
ON public.parceiros_comerciais
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND aprovado        = (SELECT aprovado        FROM public.parceiros_comerciais WHERE id = parceiros_comerciais.id)
  AND ativo           = (SELECT ativo           FROM public.parceiros_comerciais WHERE id = parceiros_comerciais.id)
  AND cpf             = (SELECT cpf             FROM public.parceiros_comerciais WHERE id = parceiros_comerciais.id)
  AND codigo_parceiro = (SELECT codigo_parceiro FROM public.parceiros_comerciais WHERE id = parceiros_comerciais.id)
  AND slug_consultor IS NOT DISTINCT FROM (SELECT slug_consultor FROM public.parceiros_comerciais WHERE id = parceiros_comerciais.id)
);