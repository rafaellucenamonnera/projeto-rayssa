DROP POLICY IF EXISTS "Parceiros update own contact info" ON public.parceiros_comerciais;

CREATE POLICY "Parceiros update own contact info"
ON public.parceiros_comerciais
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND aprovado        IS NOT DISTINCT FROM (SELECT pc.aprovado        FROM public.parceiros_comerciais pc WHERE pc.id = parceiros_comerciais.id)
  AND ativo           IS NOT DISTINCT FROM (SELECT pc.ativo           FROM public.parceiros_comerciais pc WHERE pc.id = parceiros_comerciais.id)
  AND cpf             IS NOT DISTINCT FROM (SELECT pc.cpf             FROM public.parceiros_comerciais pc WHERE pc.id = parceiros_comerciais.id)
  AND codigo_parceiro IS NOT DISTINCT FROM (SELECT pc.codigo_parceiro FROM public.parceiros_comerciais pc WHERE pc.id = parceiros_comerciais.id)
  AND slug_consultor  IS NOT DISTINCT FROM (SELECT pc.slug_consultor  FROM public.parceiros_comerciais pc WHERE pc.id = parceiros_comerciais.id)
);

-- Reafirma o trigger de defesa em profundidade
DROP TRIGGER IF EXISTS trg_prevent_partner_self_approve ON public.parceiros_comerciais;
CREATE TRIGGER trg_prevent_partner_self_approve
BEFORE UPDATE ON public.parceiros_comerciais
FOR EACH ROW
EXECUTE FUNCTION public.prevent_partner_self_approve();