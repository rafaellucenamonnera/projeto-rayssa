ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_proposta_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_proposta_status_check CHECK (proposta_status IS NULL OR proposta_status IN ('emitida','aberta','aceita'));

CREATE OR REPLACE FUNCTION public.tg_lead_proposal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  PERFORM set_config('app.system_lead_update', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.leads SET proposta_status = 'emitida', proposta_status_at = NEW.created_at WHERE id = NEW.lead_id;
    PERFORM public.touch_lead_activity(NEW.lead_id, NEW.created_at);
  ELSE
    IF NEW.opened_at IS NOT NULL AND OLD.opened_at IS NULL THEN
      UPDATE public.leads SET proposta_status = 'aberta', proposta_status_at = NEW.opened_at
      WHERE id = NEW.lead_id AND COALESCE(proposta_status, '') <> 'aceita' AND (proposta_status_at IS NULL OR proposta_status_at <= NEW.opened_at);
      PERFORM public.touch_lead_activity(NEW.lead_id, NEW.opened_at);
    END IF;
    IF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
      UPDATE public.leads SET proposta_status = 'aceita', proposta_status_at = NEW.accepted_at WHERE id = NEW.lead_id;
      PERFORM public.touch_lead_activity(NEW.lead_id, NEW.accepted_at);
    END IF;
  END IF;
  PERFORM set_config('app.system_lead_update', 'off', true);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_proposal_status ON public.commercial_proposals;
CREATE TRIGGER trg_lead_proposal_status AFTER INSERT OR UPDATE OF opened_at, accepted_at ON public.commercial_proposals FOR EACH ROW EXECUTE FUNCTION public.tg_lead_proposal_status();

SELECT set_config('app.system_lead_update', 'on', true);
UPDATE public.leads l SET proposta_status = 'aceita', proposta_status_at = p.accepted_at
FROM (SELECT DISTINCT ON (lead_id) lead_id, accepted_at FROM public.commercial_proposals ORDER BY lead_id, created_at DESC) p
WHERE p.lead_id = l.id AND p.accepted_at IS NOT NULL;
SELECT set_config('app.system_lead_update', 'off', true);