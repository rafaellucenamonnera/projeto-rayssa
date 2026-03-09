DROP POLICY IF EXISTS "Authenticated users can upload propostas" ON storage.objects;

CREATE POLICY "Admins and gestores can upload propostas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'propostas'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role))
);