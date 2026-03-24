DROP POLICY "Anon complete lead via token" ON public.leads;

CREATE POLICY "Anon complete lead via token"
ON public.leads
FOR UPDATE
TO anon, authenticated
USING (completion_token IS NOT NULL AND dados_completos = false)
WITH CHECK (completion_token IS NOT NULL);