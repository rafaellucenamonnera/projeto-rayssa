
-- Fix 1: Restrict leads SELECT 'responsible_user_id = auth.uid()' branch to staff roles only
DROP POLICY IF EXISTS "Consultor and gestor read own/responsible leads" ON public.leads;
CREATE POLICY "Consultor and gestor read own/responsible leads"
ON public.leads
FOR SELECT
USING (
  has_role(auth.uid(), 'gestor_conta'::app_role)
  OR (parceiro_id IN (
    SELECT parceiros_comerciais.id
    FROM parceiros_comerciais
    WHERE parceiros_comerciais.user_id = auth.uid()
  ))
  OR (
    responsible_user_id = auth.uid()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor_conta'::app_role)
    )
  )
);

-- Fix 2: Tighten storage SELECT on lead-comment-attachments to require ongoing lead access
DROP POLICY IF EXISTS "Owner or staff read attachments storage" ON storage.objects;
CREATE POLICY "Owner or staff read attachments storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'lead-comment-attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_conta'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.lead_comment_attachments lca
      JOIN public.leads l ON l.id = lca.lead_id
      WHERE lca.storage_path = storage.objects.name
        AND (
          l.responsible_user_id = auth.uid()
          OR l.parceiro_id IN (
            SELECT pc.id FROM public.parceiros_comerciais pc
            WHERE pc.user_id = auth.uid()
          )
        )
    )
  )
);
