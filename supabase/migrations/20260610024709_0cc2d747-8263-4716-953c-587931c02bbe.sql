-- Tighten lead_campaign_links SELECT: only admin/gestor or the requester
DROP POLICY IF EXISTS "Authenticated read lead_campaign_links" ON public.lead_campaign_links;

CREATE POLICY "Read own or staff lead_campaign_links"
ON public.lead_campaign_links
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor_conta'::app_role)
  OR requested_by_user_id = auth.uid()
);

-- Tighten storage SELECT on lead-comment-attachments: only admin/gestor or uploader (owner)
DROP POLICY IF EXISTS "Authenticated read attachments storage" ON storage.objects;

CREATE POLICY "Owner or staff read attachments storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-comment-attachments'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_conta'::app_role)
  )
);