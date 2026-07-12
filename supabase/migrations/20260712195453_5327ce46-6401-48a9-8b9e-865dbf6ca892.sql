
-- documentation_articles INSERT
DROP POLICY IF EXISTS "Docs articles insert admin only" ON public.documentation_articles;
DROP POLICY IF EXISTS "Documentation articles admin insert" ON public.documentation_articles;
CREATE POLICY "Docs articles insert admin or documentacao.inserir"
ON public.documentation_articles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'documentacao', 'inserir')
);

-- documentation_attachments INSERT
DROP POLICY IF EXISTS "Docs attachments insert admin only" ON public.documentation_attachments;
DROP POLICY IF EXISTS "Documentation attachments admin insert" ON public.documentation_attachments;
CREATE POLICY "Docs attachments insert admin or documentacao.inserir"
ON public.documentation_attachments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'documentacao', 'inserir')
);

-- storage.objects INSERT (bucket documentation-files)
DROP POLICY IF EXISTS "Docs storage insert admin only" ON storage.objects;
DROP POLICY IF EXISTS "Documentation storage admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Documentation files admin insert" ON storage.objects;
CREATE POLICY "Docs storage insert admin or documentacao.inserir"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentation-files'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'documentacao', 'inserir')
  )
);
