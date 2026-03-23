CREATE POLICY "Anon read lead via token"
ON public.leads
FOR SELECT
TO anon, authenticated
USING (completion_token IS NOT NULL AND dados_completos = false);