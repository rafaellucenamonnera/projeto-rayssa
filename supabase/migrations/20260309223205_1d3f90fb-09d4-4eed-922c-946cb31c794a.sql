-- Fix: restrict propostas bucket read to admins/gestores only
DROP POLICY IF EXISTS "Authenticated users can read propostas" ON storage.objects;

CREATE POLICY "Admins and gestores read propostas"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'propostas'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role))
);