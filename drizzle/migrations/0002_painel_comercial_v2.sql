ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS mercado text, ADD COLUMN IF NOT EXISTS tipo_negocio text, ADD COLUMN IF NOT EXISTS mrr numeric(14,2);
ALTER TABLE public.leads ADD CONSTRAINT leads_mercado_check CHECK (mercado IS NULL OR mercado IN ('farma','pet','material_construcao','autopecas','alimentar','outros'));
ALTER TABLE public.leads ADD CONSTRAINT leads_tipo_negocio_check CHECK (tipo_negocio IS NULL OR tipo_negocio IN ('varejo','distribuicao','operador_logistico','industria'));
ALTER TABLE public.leads ADD CONSTRAINT leads_mrr_check CHECK (mrr IS NULL OR mrr >= 0);

-- Automacoes do painel comercial desligadas (cards so mudam manualmente)
ALTER TABLE public.leads DISABLE TRIGGER trg_leads_ensure_onboarding_card;
ALTER TABLE public.leads DISABLE TRIGGER trg_reset_commercial_lead_stage_timer_from_leads;
SELECT cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname IN ('move-inactive-commercial-leads','commercial-proposal-followups-hourly');

CREATE OR REPLACE FUNCTION public.commercial_lead_v2_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.panel_id,'comercial') <> 'comercial' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.origem = 'link_indicacao' AND coalesce(NEW.status_lead,'novo_lead') = 'novo_lead' THEN
      NEW.status_lead := 'etapa_comercial_mql';
      NEW.status := 'etapa_comercial_mql';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status_lead IS DISTINCT FROM NEW.status_lead
     AND coalesce(current_setting('app.system_lead_update', true),'') <> 'on'
     AND NEW.status_lead NOT IN ('etapa_comercial_prospects','etapa_comercial_1781718801678','lead_perdido')
     AND (NEW.mercado IS NULL OR NEW.tipo_negocio IS NULL OR NEW.impacto IS NULL) THEN
    RAISE EXCEPTION 'Preencha Mercado, Tipo e Impacto antes de mover o card para esta coluna.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_commercial_lead_v2_guard BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.commercial_lead_v2_guard();