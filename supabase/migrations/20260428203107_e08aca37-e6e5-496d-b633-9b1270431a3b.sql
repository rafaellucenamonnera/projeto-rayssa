DROP POLICY IF EXISTS "Admins and gestores update propostas" ON storage.objects;

CREATE POLICY "Admins and gestores update propostas"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'propostas'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role))
)
WITH CHECK (
  bucket_id = 'propostas'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role))
);