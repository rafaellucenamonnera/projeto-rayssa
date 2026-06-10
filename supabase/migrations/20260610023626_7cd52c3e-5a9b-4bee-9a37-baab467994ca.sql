
-- =========================================================
-- lead_comment_attachments
-- =========================================================
CREATE TABLE IF NOT EXISTS public.lead_comment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.lead_comments(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 10485760),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_comment_attachments_comment
  ON public.lead_comment_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_lead_comment_attachments_lead
  ON public.lead_comment_attachments(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_comment_attachments TO authenticated;
GRANT ALL ON public.lead_comment_attachments TO service_role;

ALTER TABLE public.lead_comment_attachments ENABLE ROW LEVEL SECURITY;

-- Admins / gestores: full access
CREATE POLICY "Admin gestor full lead_comment_attachments"
  ON public.lead_comment_attachments
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

-- Authenticated users can read attachments of leads they can see
CREATE POLICY "Authenticated read lead_comment_attachments"
  ON public.lead_comment_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_comments lc
      WHERE lc.id = lead_comment_attachments.comment_id
    )
  );

-- Authenticated users can insert attachments to their own comments
CREATE POLICY "Authenticated insert own lead_comment_attachments"
  ON public.lead_comment_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lead_comments lc
      WHERE lc.id = lead_comment_attachments.comment_id
        AND lc.user_id = auth.uid()
    )
  );

-- Authenticated users can delete their own attachments
CREATE POLICY "Authenticated delete own lead_comment_attachments"
  ON public.lead_comment_attachments
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =========================================================
-- lead_campaign_links
-- =========================================================
CREATE TABLE IF NOT EXISTS public.lead_campaign_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  success_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  opening_task_id uuid NULL REFERENCES public.lead_tasks(id) ON DELETE SET NULL,
  requested_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_campaign_links_success
  ON public.lead_campaign_links(success_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_campaign_links_campaign
  ON public.lead_campaign_links(campaign_lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_campaign_links TO authenticated;
GRANT ALL ON public.lead_campaign_links TO service_role;

ALTER TABLE public.lead_campaign_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestor full lead_campaign_links"
  ON public.lead_campaign_links
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Authenticated read lead_campaign_links"
  ON public.lead_campaign_links
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_lead_campaign_links_updated_at
  BEFORE UPDATE ON public.lead_campaign_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Storage policies: lead-comment-attachments (private bucket)
-- =========================================================
CREATE POLICY "Admin gestor read attachments storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lead-comment-attachments'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'))
  );

CREATE POLICY "Authenticated read attachments storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-comment-attachments');

CREATE POLICY "Authenticated upload attachments storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lead-comment-attachments'
    AND owner = auth.uid()
  );

CREATE POLICY "Owner delete attachments storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lead-comment-attachments'
    AND (owner = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'))
  );
