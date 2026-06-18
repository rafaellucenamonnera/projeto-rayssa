CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _modulo text, _acao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.module_permissions
    WHERE user_id = _user_id
      AND modulo = _modulo
      AND acao = _acao
      AND permitido = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Module permission leads create" ON public.leads;
CREATE POLICY "Module permission leads create"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (public.has_module_permission(auth.uid(), 'leads', 'criar'));

DROP POLICY IF EXISTS "Module permission leads update" ON public.leads;
CREATE POLICY "Module permission leads update"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  public.has_module_permission(auth.uid(), 'leads', 'editar')
  OR public.has_module_permission(auth.uid(), 'leads', 'mover_pipeline')
  OR public.has_module_permission(auth.uid(), 'leads', 'editar_financeiro')
)
WITH CHECK (
  public.has_module_permission(auth.uid(), 'leads', 'editar')
  OR public.has_module_permission(auth.uid(), 'leads', 'mover_pipeline')
  OR public.has_module_permission(auth.uid(), 'leads', 'editar_financeiro')
);

DROP POLICY IF EXISTS "Module permission leads delete" ON public.leads;
CREATE POLICY "Module permission leads delete"
ON public.leads
FOR DELETE
TO authenticated
USING (public.has_module_permission(auth.uid(), 'leads', 'excluir'));

DROP POLICY IF EXISTS "Module permission lead tasks create" ON public.lead_tasks;
CREATE POLICY "Module permission lead tasks create"
ON public.lead_tasks
FOR INSERT
TO authenticated
WITH CHECK (public.has_module_permission(auth.uid(), 'leads', 'criar_tarefa'));

DROP POLICY IF EXISTS "Module permission lead tasks complete" ON public.lead_tasks;
CREATE POLICY "Module permission lead tasks complete"
ON public.lead_tasks
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  AND public.has_module_permission(auth.uid(), 'leads', 'concluir_tarefa')
)
WITH CHECK (
  assigned_to = auth.uid()
  AND public.has_module_permission(auth.uid(), 'leads', 'concluir_tarefa')
);

DROP POLICY IF EXISTS "Module permission lead comments create" ON public.lead_comments;
CREATE POLICY "Module permission lead comments create"
ON public.lead_comments
FOR INSERT
TO authenticated
WITH CHECK (public.has_module_permission(auth.uid(), 'leads', 'inserir_mensagem'));

DROP POLICY IF EXISTS "Module permission lead comments edit own" ON public.lead_comments;
CREATE POLICY "Module permission lead comments edit own"
ON public.lead_comments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND public.has_module_permission(auth.uid(), 'leads', 'editar_mensagem')
)
WITH CHECK (
  user_id = auth.uid()
  AND public.has_module_permission(auth.uid(), 'leads', 'editar_mensagem')
);

DROP POLICY IF EXISTS "Module permission lead comments delete own" ON public.lead_comments;
CREATE POLICY "Module permission lead comments delete own"
ON public.lead_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND public.has_module_permission(auth.uid(), 'leads', 'excluir_mensagem')
);

DROP POLICY IF EXISTS "Module permission lead attachments read" ON public.lead_comment_attachments;
CREATE POLICY "Module permission lead attachments read"
ON public.lead_comment_attachments
FOR SELECT
TO authenticated
USING (public.has_module_permission(auth.uid(), 'leads', 'acessar'));

DROP POLICY IF EXISTS "Module permission lead attachments create" ON public.lead_comment_attachments;
CREATE POLICY "Module permission lead attachments create"
ON public.lead_comment_attachments
FOR INSERT
TO authenticated
WITH CHECK (public.has_module_permission(auth.uid(), 'leads', 'inserir_arquivo'));

DROP POLICY IF EXISTS "Module permission storage lead attachments read" ON storage.objects;
CREATE POLICY "Module permission storage lead attachments read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-comment-attachments'
  AND public.has_module_permission(auth.uid(), 'leads', 'acessar')
);

DROP POLICY IF EXISTS "Module permission storage lead attachments create" ON storage.objects;
CREATE POLICY "Module permission storage lead attachments create"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-comment-attachments'
  AND public.has_module_permission(auth.uid(), 'leads', 'inserir_arquivo')
);
