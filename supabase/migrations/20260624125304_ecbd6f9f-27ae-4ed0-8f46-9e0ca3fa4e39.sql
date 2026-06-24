ALTER TABLE public.commercial_proposals
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.commercial_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_status text NOT NULL DEFAULT 'pending' CHECK (pdf_status IN ('pending','ready','failed')),
  ADD COLUMN IF NOT EXISTS pdf_error text;

CREATE INDEX IF NOT EXISTS commercial_proposals_lead_version_idx
  ON public.commercial_proposals (lead_id, version DESC);