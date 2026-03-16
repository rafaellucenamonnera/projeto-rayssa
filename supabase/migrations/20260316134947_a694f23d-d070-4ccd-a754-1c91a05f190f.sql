
-- Table to track lead stage history
CREATE TABLE public.lead_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  data_entrada timestamptz NOT NULL DEFAULT now(),
  data_saida timestamptz,
  dias_na_etapa integer
);

-- Index for fast queries
CREATE INDEX idx_lead_stage_history_lead_id ON public.lead_stage_history(lead_id);
CREATE INDEX idx_lead_stage_history_etapa ON public.lead_stage_history(etapa);

-- Enable RLS
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS: Admins and gestores can read all
CREATE POLICY "Admins and gestores read stage history"
  ON public.lead_stage_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

-- RLS: Partners can read history for their own leads
CREATE POLICY "Partners read own lead stage history"
  ON public.lead_stage_history FOR SELECT TO authenticated
  USING (lead_id IN (
    SELECT l.id FROM public.leads l
    JOIN public.parceiros_comerciais p ON p.id = l.parceiro_id
    WHERE p.user_id = auth.uid()
  ));

-- RLS: System inserts via trigger (service role), admins can manage
CREATE POLICY "Admins manage stage history"
  ON public.lead_stage_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: on lead status change, close old stage and open new
CREATE OR REPLACE FUNCTION public.track_lead_stage_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when status_lead changes
  IF OLD.status_lead IS DISTINCT FROM NEW.status_lead THEN
    -- Close the current open stage
    UPDATE public.lead_stage_history
    SET data_saida = now(),
        dias_na_etapa = EXTRACT(DAY FROM now() - data_entrada)::integer
    WHERE lead_id = NEW.id AND data_saida IS NULL;

    -- Open new stage
    INSERT INTO public.lead_stage_history (lead_id, etapa, data_entrada)
    VALUES (NEW.id, NEW.status_lead::text, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_lead_stage_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.track_lead_stage_change();

-- Trigger for new leads: record initial stage
CREATE OR REPLACE FUNCTION public.track_lead_initial_stage()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.lead_stage_history (lead_id, etapa, data_entrada)
  VALUES (NEW.id, NEW.status_lead::text, now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_lead_initial_stage
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.track_lead_initial_stage();

-- DB function: get average days per stage
CREATE OR REPLACE FUNCTION public.get_pipeline_stage_metrics()
  RETURNS json
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      etapa,
      ROUND(AVG(COALESCE(dias_na_etapa, EXTRACT(DAY FROM now() - data_entrada)::integer)), 1) as tempo_medio,
      COUNT(*) as total_passagens
    FROM public.lead_stage_history
    GROUP BY etapa
    ORDER BY
      CASE etapa
        WHEN 'novo_lead' THEN 1
        WHEN 'contato_realizado' THEN 2
        WHEN 'reuniao_agendada' THEN 3
        WHEN 'reuniao_realizada' THEN 4
        WHEN 'proposta_enviada' THEN 5
        WHEN 'lead_convertido' THEN 6
        WHEN 'contrato_enviado' THEN 7
        WHEN 'contrato_assinado' THEN 8
        WHEN 'lead_perdido' THEN 9
        ELSE 10
      END
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
