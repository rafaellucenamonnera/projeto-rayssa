-- Reset dos contadores do Painel Comercial quando houver qualquer edição relevante no card.
-- A fonte única dos contadores é lead_stage_history.data_entrada.

CREATE OR REPLACE FUNCTION public.reset_commercial_lead_stage_timer(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.lead_stage_history h
  SET data_entrada = now(),
      dias_na_etapa = NULL
  FROM public.leads l
  WHERE l.id = p_lead_id
    AND l.panel_id IN ('comercial', 'comerc')
    AND h.lead_id = l.id
    AND h.data_saida IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_commercial_lead_stage_timer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_commercial_lead_stage_timer(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_commercial_lead_stage_timer_from_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status_lead IS DISTINCT FROM NEW.status_lead THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.reset_commercial_lead_stage_timer(OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.reset_commercial_lead_st@@TIMER_PLACEHOLDER@@_timer(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_commercial_lead_stage_timer_from_leads() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reset_commercial_lead_stage_timer_from_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.reset_commercial_lead_stage_timer(OLD.lead_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
    PERFORM public.reset_commercial_lead_stage_timer(OLD.lead_id);
  END IF;

  PERFORM public.reset_commercial_lead_stage_timer(NEW.lead_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_commercial_lead_stage_timer_from_child() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reset_commercial_lead_stage_timer_from_leads ON public.leads;
CREATE TRIGGER trg_reset_commercial_lead_stage_timer_from_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_commercial_lead_stage_timer_from_leads();

DO $$
BEGIN
  IF to_regclass('public.reunioes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_reset_commercial_lead_stage_timer_from_reunioes ON public.reunioes;
    CREATE TRIGGER trg_reset_commercial_lead_stage_timer_from_reunioes
      AFTER INSERT OR UPDATE OR DELETE ON public.reunioes
      FOR EACH ROW
      EXECUTE FUNCTION public.reset_commercial_lead_stage_timer_from_child();
  END IF;

  IF to_regclass('public.lead_contatos') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_reset_commercial_lead_stage_timer_from_lead_contatos ON public.lead_contatos;
    CREATE TRIGGER trg_reset_commercial_lead_stage_timer_from_lead_contatos
      AFTER INSERT OR UPDATE OR DELETE ON public.lead_contatos
      FOR EACH ROW
      EXECUTE FUNCTION public.reset_commercial_lead_stage_timer_from_child();
  END IF;

  IF to_regclass('public.lead_tasks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_reset_commercial_lead_stage_timer_from_lead_tasks ON public.lead_tasks;
    CREATE TRIGGER trg_reset_commercial_lead_stage_timer_from_lead_tasks
      AFTER INSERT OR UPDATE OR DELETE ON public.lead_tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.reset_commercial_lead_stage_timer_from_child();
  END IF;

  IF to_regclass('public.lead_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_reset_commercial_lead_stage_timer_from_lead_comments ON public.lead_comments;
    CREATE TRIGGER trg_reset_commercial_lead_stage_timer_from_lead_comments
      AFTER INSERT OR UPDATE OR DELETE ON public.lead_comments
      FOR EACH ROW
      EXECUTE FUNCTION public.reset_commercial_lead_stage_timer_from_child();
  END IF;
END $$;