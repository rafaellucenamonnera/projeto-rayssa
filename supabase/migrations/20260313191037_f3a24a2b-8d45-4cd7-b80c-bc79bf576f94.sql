
DROP POLICY IF EXISTS "Parceiros can update own record" ON public.parceiros_comerciais;

CREATE POLICY "Parceiros can update own record"
ON public.parceiros_comerciais
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND aprovado IS NOT DISTINCT FROM (SELECT aprovado FROM public.parceiros_comerciais WHERE id = parceiros_comerciais.id)
  AND ativo IS NOT DISTINCT FROM (SELECT ativo FROM public.parceiros_comerciais WHERE id = parceiros_comerciais.id)
);
