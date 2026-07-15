-- Fix 1: tighten INSERT policy on lead_comment_attachments to require ownership of the underlying lead
DROP POLICY IF EXISTS "Module perm insert lead_comment_attachments" ON public.lead_comment_attachments;

CREATE POLICY "Module perm insert lead_comment_attachments"
ON public.lead_comment_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND has_module_permission(auth.uid(), 'leads', 'inserir_arquivo')
  AND EXISTS (
    SELECT 1
    FROM public.lead_comments lc
    JOIN public.leads l ON l.id = lc.lead_id
    LEFT JOIN public.parceiros_comerciais pc ON pc.id = l.parceiro_id
    WHERE lc.id = lead_comment_attachments.comment_id
      AND (
        lc.user_id = auth.uid()
        OR l.responsible_user_id = auth.uid()
        OR pc.user_id = auth.uid()
      )
  )
);

-- Fix 2: restrict "Consultor and gestor read own/responsible leads" to authenticated role only
DROP POLICY IF EXISTS "Consultor and gestor read own/responsible leads" ON public.leads;

CREATE POLICY "Consultor and gestor read own/responsible leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gestor_conta'::app_role)
  OR parceiro_id IN (
    SELECT parceiros_comerciais.id
    FROM public.parceiros_comerciais
    WHERE parceiros_comerciais.user_id = auth.uid()
  )
  OR (
    responsible_user_id = auth.uid()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor_conta'::app_role)
    )
  )
);