CREATE POLICY "Internal users read card attachment files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'representative-card-attachments' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta')));

CREATE POLICY "Internal users upload card attachment files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'representative-card-attachments' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta')));

CREATE POLICY "Internal users update card attachment files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'representative-card-attachments' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta')))
WITH CHECK (bucket_id = 'representative-card-attachments' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta')));

CREATE POLICY "Internal users delete card attachment files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'representative-card-attachments' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta')));