
DROP POLICY IF EXISTS "Anyone can register leads" ON public.leads;
DROP POLICY IF EXISTS "Partners insert own leads" ON public.leads;

CREATE POLICY "Partners insert own leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  parceiro_id IN (
    SELECT pc.id
    FROM public.parceiros_comerciais pc
    WHERE pc.user_id = auth.uid()
      AND pc.ativo = true
      AND pc.aprovado = true
  )
);
