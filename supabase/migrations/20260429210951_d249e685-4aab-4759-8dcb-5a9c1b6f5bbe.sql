ALTER TABLE public.pipeline_stages_config
  ADD COLUMN IF NOT EXISTS panel_key text NOT NULL DEFAULT 'comercial';

UPDATE public.pipeline_stages_config SET panel_key = 'comercial' WHERE panel_key IS NULL OR panel_key = '';

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_config_panel_value_unique
  ON public.pipeline_stages_config (panel_key, value);