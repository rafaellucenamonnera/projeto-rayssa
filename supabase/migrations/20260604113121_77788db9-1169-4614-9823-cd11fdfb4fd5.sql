ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS panel_id text NOT NULL DEFAULT 'comercial';

UPDATE public.leads
SET panel_id = 'comercial'
WHERE panel_id IS NULL OR panel_id = '';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_panel_id_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_panel_id_fkey
  FOREIGN KEY (panel_id)
  REFERENCES public.pipeline_panels(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_leads_panel_id ON public.leads(panel_id);