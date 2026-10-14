ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS temperatura text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ultima_atualizacao_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS proposta_status text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS proposta_status_at timestamptz;

CREATE OR REPLACE FUNCTION public.touch_lead_activity(_lead_id uuid, _at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.system_lead_update', 'on', true);
  UPDATE public.leads SET ultima_atualizacao_at = GREATEST(COALESCE(ultima_atualizacao_at, _at), _at)
  WHERE id = _lead_id AND (ultima_atualizacao_at IS NULL OR ultima_atualizacao_at < _at);
  PERFORM set_config('app.system_lead_update', 'off', true);
END $$;

CREATE OR REPLACE FUNCTION public.tg_lead_activity_from_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.touch_lead_activity(NEW.lead_id, COALESCE(NEW.data_comentario, now()));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_lead_activity_from_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.touch_lead_activity(NEW.lead_id, COALESCE(NEW.data_entrada, now()));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_lead_proposal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  PERFORM set_config('app.system_lead_update', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.leads SET proposta_status = 'emitida', proposta_status_at = NEW.created_at WHERE id = NEW.lead_id;
    PERFORM public.touch_lead_activity(NEW.lead_id, NEW.created_at);
  ELSIF NEW.opened_at IS NOT NULL AND OLD.opened_at IS NULL THEN
    UPDATE public.leads SET proposta_status = 'aberta', proposta_status_at = NEW.opened_at
    WHERE id = NEW.lead_id AND (proposta_status_at IS NULL OR proposta_status_at <= NEW.opened_at);
    PERFORM public.touch_lead_activity(NEW.lead_id, NEW.opened_at);
  END IF;
  PERFORM set_config('app.system_lead_update', 'off', true);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_activity_from_comment ON public.lead_comments;
CREATE TRIGGER trg_lead_activity_from_comment AFTER INSERT ON public.lead_comments FOR EACH ROW EXECUTE FUNCTION public.tg_lead_activity_from_comment();
DROP TRIGGER IF EXISTS trg_lead_activity_from_stage ON public.lead_stage_history;
CREATE TRIGGER trg_lead_activity_from_stage AFTER INSERT ON public.lead_stage_history FOR EACH ROW EXECUTE FUNCTION public.tg_lead_activity_from_stage();
DROP TRIGGER IF EXISTS trg_lead_proposal_status ON public.commercial_proposals;
CREATE TRIGGER trg_lead_proposal_status AFTER INSERT OR UPDATE OF opened_at ON public.commercial_proposals FOR EACH ROW EXECUTE FUNCTION public.tg_lead_proposal_status();

SELECT set_config('app.system_lead_update', 'on', true);
UPDATE public.leads l SET
  ultima_atualizacao_at = GREATEST(
    l.data_cadastro,
    (SELECT max(c.data_comentario) FROM public.lead_comments c WHERE c.lead_id = l.id),
    (SELECT max(h.data_entrada) FROM public.lead_stage_history h WHERE h.lead_id = l.id),
    (SELECT max(GREATEST(p.created_at, COALESCE(p.opened_at, p.created_at))) FROM public.commercial_proposals p WHERE p.lead_id = l.id)
  ),
  proposta_status = (SELECT CASE WHEN p.opened_at IS NOT NULL THEN 'aberta' ELSE 'emitida' END FROM public.commercial_proposals p WHERE p.lead_id = l.id ORDER BY p.created_at DESC LIMIT 1),
  proposta_status_at = (SELECT COALESCE(p.opened_at, p.created_at) FROM public.commercial_proposals p WHERE p.lead_id = l.id ORDER BY p.created_at DESC LIMIT 1)
WHERE l.panel_id IN ('comercial','comerc');
SELECT set_config('app.system_lead_update', 'off', true);

ALTER TABLE public.leads ADD CONSTRAINT leads_temperatura_check CHECK (temperatura IS NULL OR temperatura IN ('fria','morna','quente'));
ALTER TABLE public.leads ADD CONSTRAINT leads_proposta_status_check CHECK (proposta_status IS NULL OR proposta_status IN ('emitida','aberta'));