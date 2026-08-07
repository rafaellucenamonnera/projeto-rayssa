ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS focal_name text,
  ADD COLUMN IF NOT EXISTS focal_phone text,
  ADD COLUMN IF NOT EXISTS focal_email text,
  ADD COLUMN IF NOT EXISTS contratante_monnera text,
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS vendor_phone text,
  ADD COLUMN IF NOT EXISTS vendor_email text;

CREATE TABLE public.representative_card_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.representative_card_attachments TO authenticated;
GRANT ALL ON public.representative_card_attachments TO service_role;

ALTER TABLE public.representative_card_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores manage card attachments"
ON public.representative_card_attachments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_conta'));

CREATE INDEX idx_rep_card_attachments_card ON public.representative_card_attachments(representative_card_id);