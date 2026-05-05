ALTER TABLE public.pipeline_stages_config
  DROP CONSTRAINT IF EXISTS pipeline_stages_config_value_key;

DROP INDEX IF EXISTS public.pipeline_stages_config_value_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_value_per_panel
  ON public.pipeline_stages_config(panel_key, value);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS revenue_current numeric NULL,
  ADD COLUMN IF NOT EXISTS revenue_previous numeric NULL,
  ADD COLUMN IF NOT EXISTS revenue_variation numeric NULL;

CREATE INDEX IF NOT EXISTS idx_leads_revenue_history
  ON public.leads(status, status_lead, revenue_current);