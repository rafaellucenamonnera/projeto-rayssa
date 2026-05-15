CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.representative_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id TEXT NOT NULL REFERENCES public.pipeline_panels(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT,
  state TEXT,
  region TEXT,
  notes TEXT,
  status TEXT,
  source TEXT,
  csv_import_batch_id TEXT,
  responsible_user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT representative_cards_panel_stage_fk
    FOREIGN KEY (panel_id, stage_id)
    REFERENCES public.pipeline_stages_config(panel_key, value)
);

CREATE INDEX IF NOT EXISTS idx_representative_cards_panel_id ON public.representative_cards(panel_id);
CREATE INDEX IF NOT EXISTS idx_representative_cards_stage_id ON public.representative_cards(stage_id);
CREATE INDEX IF NOT EXISTS idx_representative_cards_responsible_user_id ON public.representative_cards(responsible_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS representative_cards_panel_email_uniq ON public.representative_cards(panel_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS representative_cards_panel_phone_uniq ON public.representative_cards(panel_id, phone);

ALTER TABLE public.representative_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores read representative cards"
ON public.representative_cards
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores write representative cards"
ON public.representative_cards
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE TRIGGER update_representative_cards_updated_at
BEFORE UPDATE ON public.representative_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();