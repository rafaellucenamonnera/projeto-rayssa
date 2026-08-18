ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS jira_issue_status text,
  ADD COLUMN IF NOT EXISTS jira_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS jira_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS jira_last_error text;

CREATE TABLE IF NOT EXISTS public.card_field_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_value text,
  source text NOT NULL CHECK (source IN ('email','whatsapp','jira_webhook','jira_email','card_vinculado','manual','sistema')),
  source_record_id uuid,
  evidence text,
  confidence text,
  status text NOT NULL DEFAULT 'registrado' CHECK (status IN ('registrado','consolidado','divergente','descartado')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_field_provenance_card_idx ON public.card_field_provenance(card_id, field_name);
GRANT SELECT, INSERT, UPDATE ON public.card_field_provenance TO authenticated;
GRANT ALL ON public.card_field_provenance TO service_role;
ALTER TABLE public.card_field_provenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read card provenance" ON public.card_field_provenance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_conta'));
CREATE POLICY "Staff write card provenance" ON public.card_field_provenance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_conta'));

CREATE TABLE IF NOT EXISTS public.card_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('email','whatsapp','jira','manual')),
  source_record_id uuid,
  thread_id text,
  link_mode text NOT NULL DEFAULT 'manual' CHECK (link_mode IN ('automatico','manual')),
  justification text,
  active boolean NOT NULL DEFAULT true,
  unlinked_at timestamptz,
  unlinked_by uuid,
  unlink_justification text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_source_links_card_idx ON public.card_source_links(card_id) WHERE active;
GRANT SELECT, INSERT, UPDATE ON public.card_source_links TO authenticated;
GRANT ALL ON public.card_source_links TO service_role;
ALTER TABLE public.card_source_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read card source links" ON public.card_source_links
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_conta'));
CREATE POLICY "Admins manage card source links" ON public.card_source_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'iniciado' CHECK (status IN ('iniciado','sucesso','erro','timeout','ignorado','duplicado')),
  error text,
  origin text,
  cursor text,
  attempt integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS automation_runs_stage_idx ON public.automation_runs(stage, started_at DESC);
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read automation runs" ON public.automation_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_conta'));

CREATE OR REPLACE FUNCTION public.record_automation_run(
  p_stage text,
  p_status text,
  p_card_id uuid DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.automation_runs (stage, status, card_id, error, origin, payload, finished_at)
  VALUES (p_stage, p_status, p_card_id, p_error, p_origin, COALESCE(p_payload,'{}'::jsonb),
          CASE WHEN p_status = 'iniciado' THEN NULL ELSE now() END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;